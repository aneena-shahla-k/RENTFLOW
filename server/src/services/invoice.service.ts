import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { Booking, IBooking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Company, ICompany } from '../models/Company.js';
import { IInvoice, Invoice } from '../models/Invoice.js';
import { IUser, User } from '../models/User.js';
import { formatMoney } from '../utils/money.js';

export async function ensureInvoiceForBooking(
  booking: IBooking,
  paymentId?: string
): Promise<IInvoice> {
  const existing = await Invoice.findOne({ bookingId: booking._id });
  if (existing) {
    if (paymentId && !existing.paymentId) {
      existing.paymentId = paymentId as unknown as IInvoice['paymentId'];
      existing.status = 'paid';
      await existing.save();
    }
    return existing;
  }

  const company = await Company.findById(booking.companyId);
  const invoiceNumber = `INV-${new Date().getUTCFullYear()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;

  return Invoice.create({
    invoiceNumber,
    companyId: booking.companyId,
    bookingId: booking._id,
    customerId: booking.customerId,
    paymentId,
    currency: company?.settings?.currency || 'INR',
    currencySymbol: company?.settings?.currencySymbol || '₹',
    subtotal: booking.pricing.rentalSubtotal,
    discountAmount: booking.pricing.discountAmount,
    taxRate: booking.pricing.taxRate,
    taxAmount: booking.pricing.taxAmount,
    deliveryFee: booking.pricing.deliveryFee,
    securityDeposit: booking.pricing.securityDeposit,
    lateFeeAmount: booking.pricing.lateFeeAmount || 0,
    damageFeeAmount: booking.pricing.damageFeeAmount || 0,
    totalAmount: booking.pricing.totalAmount,
    status: booking.paymentStatus === 'paid' ? 'paid' : 'issued',
    issuedAt: new Date(),
  });
}

export async function generateInvoicePdfBuffer(invoiceId: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const [company, customer, booking, items] = await Promise.all([
    Company.findById(invoice.companyId) as Promise<ICompany | null>,
    User.findById(invoice.customerId) as Promise<IUser | null>,
    Booking.findById(invoice.bookingId),
    BookingItem.find({ bookingId: invoice.bookingId }),
  ]);

  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const cur = invoice.currency;
  const sym = invoice.currencySymbol;

  // Header
  doc.fillColor('#0F172A').fontSize(20).font('Helvetica-Bold').text('RentFlow Tax Invoice', 48, 48);
  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#64748B')
    .text(`Invoice #: ${invoice.invoiceNumber}`, 48, 76)
    .text(`Booking Ref: ${booking?.bookingReference || '—'}`, 48, 91)
    .text(`Issued: ${invoice.issuedAt.toISOString().slice(0, 10)}`, 48, 106)
    .text(`Status: ${invoice.status.toUpperCase()}`, 48, 121);

  // Company block on right
  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(company?.name || 'Rental Vendor', 340, 48, { align: 'right' });
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#475569')
    .text(company?.email || '', 340, 66, { align: 'right' })
    .text(company?.phone || '', 340, 80, { align: 'right' });
  if (company?.settings?.gstNumber) {
    doc.text(`GSTIN: ${company.settings.gstNumber}`, 340, 94, { align: 'right' });
  }

  doc.moveTo(48, 148).lineTo(547, 148).strokeColor('#E2E8F0').stroke();

  // Customer info
  doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(10).text('Billed To:', 48, 165);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#334155')
    .text(customer?.name || 'Customer', 48, 181)
    .text(customer?.email || '', 48, 196)
    .text(customer?.phone || '', 48, 211);

  if (booking) {
    doc
      .font('Helvetica-Bold')
      .fillColor('#0F172A')
      .text('Rental Period:', 340, 165, { align: 'right' })
      .font('Helvetica')
      .fillColor('#334155')
      .text(
        `${booking.startDate.toISOString().slice(0, 10)} to ${booking.endDate.toISOString().slice(0, 10)} (${booking.rentalDays} days)`,
        300,
        181,
        { align: 'right' }
      )
      .text(`Fulfillment: ${booking.fulfillmentType.toUpperCase()}`, 340, 196, { align: 'right' });
  }

  // Table header
  let y = 248;
  doc.rect(48, y, 499, 24).fill('#F1F5F9');
  doc
    .fillColor('#0F172A')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Item / SKU', 56, y + 7)
    .text('Qty', 310, y + 7)
    .text('Daily Rate', 370, y + 7)
    .text('Subtotal', 460, y + 7, { width: 80, align: 'right' });

  y += 32;
  doc.font('Helvetica').fontSize(9).fillColor('#334155');
  for (const item of items) {
    doc
      .text(`${item.productName} (${item.productSku})`, 56, y, { width: 245 })
      .text(String(item.quantity), 310, y)
      .text(formatMoney(item.unitDailyPrice, sym, cur), 370, y)
      .text(formatMoney(item.lineSubtotal, sym, cur), 460, y, { width: 80, align: 'right' });
    y += 22;
  }

  y += 12;
  doc.moveTo(310, y).lineTo(547, y).strokeColor('#E2E8F0').stroke();
  y += 12;

  const summaryRows: Array<[string, number]> = [
    ['Rental Subtotal', invoice.subtotal],
    ['Discount', -invoice.discountAmount],
    [`Tax / GST (${invoice.taxRate}%)`, invoice.taxAmount],
    ['Delivery Charge', invoice.deliveryFee],
    ['Security Deposit (Refundable)', invoice.securityDeposit],
  ];
  if (invoice.lateFeeAmount > 0) summaryRows.push(['Late Fees', invoice.lateFeeAmount]);
  if (invoice.damageFeeAmount > 0) summaryRows.push(['Damage / Repair Charges', invoice.damageFeeAmount]);

  for (const [label, amount] of summaryRows) {
    doc
      .font('Helvetica')
      .fillColor('#475569')
      .text(label, 310, y)
      .text(formatMoney(amount, sym, cur), 450, y, { width: 97, align: 'right' });
    y += 18;
  }

  y += 6;
  doc.moveTo(310, y).lineTo(547, y).strokeColor('#0F172A').stroke();
  y += 10;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#0F172A')
    .text('Total Amount', 310, y)
    .text(formatMoney(invoice.totalAmount, sym, cur), 440, y, { width: 107, align: 'right' });

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#94A3B8')
    .text('Generated by RentFlow — Rent smarter. Manage better.', 48, 760, { align: 'center' });

  doc.end();
  const buffer = await done;
  return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
}
