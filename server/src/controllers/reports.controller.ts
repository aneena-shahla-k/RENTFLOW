import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { AuthRequest } from '../types/index.js';

function getDateWindow(req: AuthRequest) {
  const now = new Date();
  const end = req.query.endDate ? new Date(String(req.query.endDate)) : new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = req.query.startDate
    ? new Date(String(req.query.startDate))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export async function getRevenueReport(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const { start, end } = getDateWindow(req);

  const [summaryAgg, monthlySeries, taxReport] = await Promise.all([
    Booking.aggregate([
      { $match: { companyId, paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          rentalSubtotal: { $sum: '$pricing.rentalSubtotal' },
          taxCollected: { $sum: '$pricing.taxAmount' },
          deliveryCollected: { $sum: '$pricing.deliveryFee' },
          depositsHeld: { $sum: '$pricing.securityDeposit' },
          bookingCount: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { companyId, paymentStatus: 'paid', createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$pricing.totalAmount' },
          tax: { $sum: '$pricing.taxAmount' },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payment.find({ companyId, createdAt: { $gte: start, $lte: end } })
      .populate('bookingId', 'bookingReference')
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100),
  ]);

  res.json({
    success: true,
    data: {
      summary: summaryAgg[0] || {
        totalRevenue: 0,
        rentalSubtotal: 0,
        taxCollected: 0,
        deliveryCollected: 0,
        depositsHeld: 0,
        bookingCount: 0,
      },
      monthlySeries,
      payments: taxReport,
    },
  });
}

export async function getBookingsReport(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const { start, end } = getDateWindow(req);

  const [byStatus, overdueBookings, customerActivity] = await Promise.all([
    Booking.aggregate([
      { $match: { companyId, createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: '$status', count: { $sum: 1 }, totalValue: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.find({
      companyId,
      $or: [{ status: 'overdue' }, { status: 'active_rental', endDate: { $lt: new Date() } }],
    })
      .populate('customerId', 'name email phone')
      .sort({ endDate: 1 }),
    Booking.aggregate([
      { $match: { companyId, createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$customerId',
          bookings: { $sum: 1 },
          totalSpent: { $sum: '$pricing.totalAmount' },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
      {
        $project: {
          customerName: '$customer.name',
          customerEmail: '$customer.email',
          bookings: 1,
          totalSpent: 1,
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      byStatus,
      overdueBookings,
      topCustomers: customerActivity,
    },
  });
}

export async function getInventoryReport(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;

  const productFilter: Record<string, unknown> = { companyId, status: { $ne: 'archived' } };
  if (categoryId) productFilter.categoryId = categoryId;

  const [products, itemStats] = await Promise.all([
    Product.find(productFilter).populate('categoryId', 'name').sort({ name: 1 }),
    BookingItem.aggregate([
      { $match: { companyId } },
      {
        $group: {
          _id: '$productId',
          timesBooked: { $sum: 1 },
          totalUnitsRented: { $sum: '$quantity' },
          totalRevenue: { $sum: '$lineSubtotal' },
        },
      },
    ]),
  ]);

  const statsMap = new Map(itemStats.map((s) => [s._id.toString(), s]));

  const performance = products.map((p) => {
    const st = statsMap.get(p._id.toString());
    const utilizationPercent =
      p.totalStock > 0
        ? Math.round(((p.totalStock - p.availableStock) / p.totalStock) * 100)
        : 0;
    return {
      _id: p._id,
      name: p.name,
      sku: p.sku,
      category: (p.categoryId as unknown as { name?: string })?.name || '—',
      status: p.status,
      totalStock: p.totalStock,
      availableStock: p.availableStock,
      utilizationPercent,
      timesBooked: st?.timesBooked || 0,
      totalUnitsRented: st?.totalUnitsRented || 0,
      totalRevenue: st?.totalRevenue || 0,
    };
  });

  res.json({
    success: true,
    data: { performance },
  });
}

export async function exportReportCsv(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const bookings = await Booking.find({ companyId })
    .populate('customerId', 'name email')
    .sort({ createdAt: -1 })
    .limit(500);

  const header = 'BookingRef,CustomerName,CustomerEmail,StartDate,EndDate,Days,Status,PaymentStatus,Subtotal,Tax,Deposit,Total\n';
  const rows = bookings
    .map((b) => {
      const cust = b.customerId as unknown as { name?: string; email?: string };
      return [
        b.bookingReference,
        `"${(cust?.name || '').replace(/"/g, '""')}"`,
        cust?.email || '',
        b.startDate.toISOString().slice(0, 10),
        b.endDate.toISOString().slice(0, 10),
        b.rentalDays,
        b.status,
        b.paymentStatus,
        (b.pricing.rentalSubtotal / 100).toFixed(2),
        (b.pricing.taxAmount / 100).toFixed(2),
        (b.pricing.securityDeposit / 100).toFixed(2),
        (b.pricing.totalAmount / 100).toFixed(2),
      ].join(',');
    })
    .join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="rentflow-bookings-report.csv"');
  res.send(header + rows);
}

export async function exportReportPdf(req: AuthRequest, res: Response): Promise<void> {
  const companyId = req.companyId!;
  const bookings = await Booking.find({ companyId })
    .populate('customerId', 'name')
    .sort({ createdAt: -1 })
    .limit(40);

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).font('Helvetica-Bold').text('RentFlow Business Report', 40, 40);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B').text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 40, 65);

  let y = 95;
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
  doc.text('Reference', 40, y).text('Customer', 135, y).text('Dates', 260, y).text('Status', 385, y).text('Total', 475, y, { width: 70, align: 'right' });
  y += 16;
  doc.moveTo(40, y).lineTo(545, y).strokeColor('#CBD5E1').stroke();
  y += 8;

  doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
  for (const b of bookings) {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    const cust = b.customerId as unknown as { name?: string };
    doc
      .text(b.bookingReference, 40, y)
      .text(cust?.name || 'Customer', 135, y, { width: 120 })
      .text(`${b.startDate.toISOString().slice(0, 10)} → ${b.endDate.toISOString().slice(0, 10)}`, 260, y)
      .text(b.status, 385, y)
      .text((b.pricing.totalAmount / 100).toFixed(2), 475, y, { width: 70, align: 'right' });
    y += 18;
  }

  doc.end();
  const buffer = await done;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="rentflow-business-report.pdf"');
  res.send(buffer);
}
