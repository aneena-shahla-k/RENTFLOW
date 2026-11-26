import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Category } from '../models/Category.js';
import { Company } from '../models/Company.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Delivery } from '../models/Delivery.js';
import { Invoice } from '../models/Invoice.js';
import { Notification } from '../models/Notification.js';
import { Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { RentalReturn } from '../models/RentalReturn.js';
import { Review } from '../models/Review.js';
import { Subscription } from '../models/Subscription.js';
import { SupportTicket } from '../models/SupportTicket.js';
import { User } from '../models/User.js';
import { SUBSCRIPTION_PLANS } from '../types/index.js';
import { normalizeRentalRange } from '../utils/dateRange.js';

function createDemoProductSvg(filename: string, title: string, accent: string, label: string): string {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#F8FAFC"/>
        <stop offset="100%" stop-color="#EEF2FF"/>
      </linearGradient>
    </defs>
    <rect width="640" height="420" fill="url(#g)"/>
    <rect x="40" y="40" width="560" height="340" rx="24" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>
    <circle cx="320" cy="170" r="62" fill="${accent}" fill-opacity="0.12"/>
    <rect x="284" y="138" width="72" height="64" rx="14" fill="${accent}"/>
    <circle cx="320" cy="170" r="18" fill="#FFFFFF"/>
    <text x="320" y="274" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#0F172A">${title}</text>
    <text x="320" y="308" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="#64748B">${label}</text>
  </svg>`;
  fs.writeFileSync(path.join(uploadsDir, filename), svg, 'utf8');
  return `/uploads/${filename}`;
}

async function seed() {
  if (env.NODE_ENV === 'production') {
    console.error('Demo seeding is disabled in production.');
    process.exit(1);
  }

  await connectDatabase();

  // Clear existing demo data cleanly
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMembership.deleteMany({}),
    Subscription.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    Booking.deleteMany({}),
    BookingItem.deleteMany({}),
    Payment.deleteMany({}),
    Invoice.deleteMany({}),
    RentalReturn.deleteMany({}),
    Delivery.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    SupportTicket.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);

  const demoPasswordHash = await bcrypt.hash('DemoPass!2026', 10);
  const superAdminPassword = env.DEV_SUPERADMIN_PASSWORD || 'SuperAdmin@2026!';
  const superAdminHash = await bcrypt.hash(superAdminPassword, 10);

  // 1. Super Admin
  const superAdmin = await User.create({
    name: 'RentFlow Platform Admin',
    email: (env.DEV_SUPERADMIN_EMAIL || 'superadmin@rentflow.local').toLowerCase(),
    phone: '+91 90000 00001',
    passwordHash: superAdminHash,
    role: 'super_admin',
    isEmailVerified: true,
  });

  // 2. Demo Company A Users (Owner, Admin, 2 Staff)
  const ownerA = await User.create({
    name: 'Rohan Verma',
    email: 'owner@apexrentals.local',
    phone: '+91 98765 10001',
    passwordHash: demoPasswordHash,
    role: 'company_owner',
    isEmailVerified: true,
  });

  const adminA = await User.create({
    name: 'Ananya Rao',
    email: 'admin@apexrentals.local',
    phone: '+91 98765 10002',
    passwordHash: demoPasswordHash,
    role: 'company_admin',
    isEmailVerified: true,
  });

  const staff1 = await User.create({
    name: 'Karan Mehta',
    email: 'staff1@apexrentals.local',
    phone: '+91 98765 10003',
    passwordHash: demoPasswordHash,
    role: 'rental_staff',
    isEmailVerified: true,
  });

  const staff2 = await User.create({
    name: 'Vikram Singh',
    email: 'staff2@apexrentals.local',
    phone: '+91 98765 10004',
    passwordHash: demoPasswordHash,
    role: 'rental_staff',
    isEmailVerified: true,
  });

  // Company A
  const companyA = await Company.create({
    name: 'Apex Lens & Tech Rentals',
    slug: 'apex-lens-tech-rentals',
    companyCode: 'RF-APEX01',
    businessType: 'Cameras & Photography Equipment',
    description: 'Cinema cameras, lenses, workstations, and studio production gear across Bengaluru.',
    email: 'ops@apexrentals.local',
    phone: '+91 80 4123 9000',
    address: {
      street: '42 Indiranagar 100ft Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560038',
    },
    status: 'approved',
    ownerId: ownerA._id,
    onboardingCompleted: true,
    onboardingStep: 8,
    settings: {
      currency: 'INR',
      currencySymbol: '₹',
      taxEnabled: true,
      taxRate: 18,
      taxInclusive: false,
      gstNumber: '29AABCA1234F1Z2',
      deliveryEnabled: true,
      defaultDeliveryFee: 30000,
      lateFeePerDayPercent: 25,
      securityDepositRequired: true,
      cancellationWindowHours: 24,
      minRentalDays: 1,
      maxRentalDays: 90,
      bookingHoldMinutes: 15,
      allowExtensions: true,
    },
  });

  await CompanyMembership.insertMany([
    { userId: ownerA._id, companyId: companyA._id, role: 'company_owner', status: 'active', permissions: ['*'] },
    { userId: adminA._id, companyId: companyA._id, role: 'company_admin', status: 'active', permissions: ['manage_all'], invitedBy: ownerA._id },
    { userId: staff1._id, companyId: companyA._id, role: 'rental_staff', status: 'active', permissions: ['manage_bookings', 'manage_returns'], invitedBy: ownerA._id },
    { userId: staff2._id, companyId: companyA._id, role: 'rental_staff', status: 'active', permissions: ['manage_deliveries', 'manage_returns'], invitedBy: ownerA._id },
  ]);

  await Subscription.create({
    companyId: companyA._id,
    plan: 'professional',
    status: 'active',
    mode: 'dev_simulated',
    billingCycle: 'monthly',
    priceInSmallestUnit: SUBSCRIPTION_PLANS.professional.monthlyPriceInSmallestUnit,
  });

  // 3. Second Company B (for multi-tenant isolation verification)
  const ownerB = await User.create({
    name: 'Siddharth Kapoor',
    email: 'owner@urbanfleet.local',
    phone: '+91 98765 20001',
    passwordHash: demoPasswordHash,
    role: 'company_owner',
    isEmailVerified: true,
  });

  const companyB = await Company.create({
    name: 'UrbanFleet Tools & Mobility',
    slug: 'urbanfleet-tools-mobility',
    companyCode: 'RF-URBAN2',
    businessType: 'Construction Equipment',
    description: 'Site tools, power generators, and commercial utility rentals.',
    email: 'ops@urbanfleet.local',
    phone: '+91 22 4001 8800',
    address: {
      street: '18 Lower Parel Industrial Estate',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400013',
    },
    status: 'approved',
    ownerId: ownerB._id,
    onboardingCompleted: true,
    onboardingStep: 8,
  });

  await CompanyMembership.create({
    userId: ownerB._id,
    companyId: companyB._id,
    role: 'company_owner',
    status: 'active',
    permissions: ['*'],
  });

  await Subscription.create({
    companyId: companyB._id,
    plan: 'starter',
    status: 'trialing',
    mode: 'dev_simulated',
    billingCycle: 'monthly',
    priceInSmallestUnit: SUBSCRIPTION_PLANS.starter.monthlyPriceInSmallestUnit,
  });

  // 4. Customers
  const [cust1, cust2, cust3] = await User.create([
    { name: 'Priya Nair', email: 'priya@customer.local', phone: '+91 98111 11111', passwordHash: demoPasswordHash, role: 'customer', isEmailVerified: true },
    { name: 'Arjun Malhotra', email: 'arjun@customer.local', phone: '+91 98222 22222', passwordHash: demoPasswordHash, role: 'customer', isEmailVerified: true },
    { name: 'Meera Krishnan', email: 'meera@customer.local', phone: '+91 98333 33333', passwordHash: demoPasswordHash, role: 'customer', isEmailVerified: true },
  ]);

  // 5. Categories for Company A & Company B
  const [catCam, catLaptop, catEvent, catAudio, catFurn, catVehicle] = await Category.create([
    { companyId: companyA._id, name: 'Cameras & Photography', slug: 'cameras-photography', description: 'Cinema cameras, mirrorless bodies, and prime lenses.' },
    { companyId: companyA._id, name: 'Laptops & Electronics', slug: 'laptops-electronics', description: 'Workstations, displays, and production tablets.' },
    { companyId: companyA._id, name: 'Event Equipment', slug: 'event-equipment', description: 'Projectors, truss lighting, and staging rigs.' },
    { companyId: companyA._id, name: 'Audio & Studio Lighting', slug: 'audio-lighting', description: 'Wireless mics, mixers, and COB LED panels.' },
    { companyId: companyA._id, name: 'Studio Furniture', slug: 'studio-furniture', description: 'Modular sets, director chairs, and production desks.' },
    { companyId: companyB._id, name: 'Construction & Tools', slug: 'construction-tools', description: 'Generators, drills, and utility fleets.' },
  ]);

  // 6. 14 Sample Products (12 in Company A, 2 in Company B)
  const productSeeds = [
    { companyId: companyA._id, categoryId: catCam._id, name: 'Sony FX6 Cinema Camera Kit', sku: 'CAM-FX6-01', brand: 'Sony', model: 'ILME-FX6V', pricePerDay: 450000, pricePerWeek: 2700000, pricePerMonth: 9000000, securityDeposit: 1500000, totalStock: 10, availableStock: 8, condition: 'excellent', location: 'Indiranagar Vault', desc: 'Full-frame 4K cinema line camera with 24-70mm GM II lens and dual batteries.', accent: '#4F46E5' },
    { companyId: companyA._id, categoryId: catCam._id, name: 'Canon EOS R5 C Hybrid Body', sku: 'CAM-R5C-02', brand: 'Canon', model: 'EOS R5 C', pricePerDay: 320000, pricePerWeek: 1900000, pricePerMonth: 6500000, securityDeposit: 1000000, totalStock: 6, availableStock: 6, condition: 'new', location: 'Indiranagar Vault', desc: '8K RAW internal cinema hybrid camera ready for commercial shoots.', accent: '#4F46E5' },
    { companyId: companyA._id, categoryId: catCam._id, name: 'DJI Ronin RS4 Pro Gimbal', sku: 'GMB-RS4-03', brand: 'DJI', model: 'RS4 Pro', pricePerDay: 110000, pricePerWeek: 650000, pricePerMonth: 2100000, securityDeposit: 400000, totalStock: 8, availableStock: 7, condition: 'excellent', location: 'Indiranagar Vault', desc: 'Carbon fiber 3-axis stabilizer supporting up to 4.5kg payloads.', accent: '#6366F1' },
    { companyId: companyA._id, categoryId: catCam._id, name: 'Sony FE 70-200mm f/2.8 GM II', sku: 'LNS-70200-04', brand: 'Sony', model: 'SEL70200GM2', pricePerDay: 160000, pricePerWeek: 950000, pricePerMonth: 3200000, securityDeposit: 500000, totalStock: 5, availableStock: 5, condition: 'excellent', location: 'Indiranagar Vault', desc: 'Telephoto zoom G Master lens with rapid AF and optical stabilization.', accent: '#4338CA' },
    { companyId: companyA._id, categoryId: catLaptop._id, name: 'MacBook Pro 16" M3 Max (64GB)', sku: 'LAP-MBP-05', brand: 'Apple', model: 'M3 Max 16', pricePerDay: 220000, pricePerWeek: 1300000, pricePerMonth: 4500000, securityDeposit: 800000, totalStock: 12, availableStock: 10, condition: 'new', location: 'Koramangala Hub', desc: 'High-memory editing workstation pre-configured for color grading and 3D.', accent: '#0F172A' },
    { companyId: companyA._id, categoryId: catLaptop._id, name: 'Dell Precision 5680 Mobile Workstation', sku: 'LAP-DELL-06', brand: 'Dell', model: 'Precision 5680', pricePerDay: 180000, pricePerWeek: 1050000, pricePerMonth: 3800000, securityDeposit: 600000, totalStock: 8, availableStock: 8, condition: 'excellent', location: 'Koramangala Hub', desc: 'RTX Ada workstation laptop for CAD, simulation, and event control.', accent: '#0F172A' },
    { companyId: companyA._id, categoryId: catLaptop._id, name: 'Apple iPad Pro 13" M4 + Pencil', sku: 'TAB-IPAD-07', brand: 'Apple', model: 'iPad Pro M4', pricePerDay: 85000, pricePerWeek: 500000, pricePerMonth: 1700000, securityDeposit: 300000, totalStock: 15, availableStock: 15, condition: 'new', location: 'Koramangala Hub', desc: 'OLED wireless director monitor and registration kiosk tablet.', accent: '#334155' },
    { companyId: companyA._id, categoryId: catAudio._id, name: 'Aputure 600d Pro LED Light Kit', sku: 'LGT-600D-08', brand: 'Aputure', model: 'LS 600d Pro', pricePerDay: 190000, pricePerWeek: 1100000, pricePerMonth: 3600000, securityDeposit: 500000, totalStock: 7, availableStock: 6, condition: 'excellent', location: 'Indiranagar Vault', desc: 'Weather-resistant 600W daylight COB LED with Light Dome III.', accent: '#D97706' },
    { companyId: companyA._id, categoryId: catAudio._id, name: 'Rode Wireless PRO Dual Mic Kit', sku: 'AUD-RODE-09', brand: 'Rode', model: 'Wireless PRO', pricePerDay: 65000, pricePerWeek: 380000, pricePerMonth: 1200000, securityDeposit: 150000, totalStock: 14, availableStock: 14, condition: 'good', location: 'Indiranagar Vault', desc: '32-bit float onboard recording dual-channel wireless lavalier system.', accent: '#059669' },
    { companyId: companyA._id, categoryId: catEvent._id, name: 'Epson 6000-Lumen Laser Projector', sku: 'EVT-PROJ-10', brand: 'Epson', model: 'EB-L630U', pricePerDay: 350000, pricePerWeek: 2100000, pricePerMonth: 7000000, securityDeposit: 900000, totalStock: 4, availableStock: 4, condition: 'excellent', location: 'HSR Staging Depot', desc: 'WUXGA laser venue projector with short-throw lens option.', accent: '#0284C7' },
    { companyId: companyA._id, categoryId: catEvent._id, name: 'QSC K12.2 Active PA Speaker Pair', sku: 'EVT-QSC-11', brand: 'QSC', model: 'K12.2 Pair', pricePerDay: 240000, pricePerWeek: 1400000, pricePerMonth: 4600000, securityDeposit: 500000, totalStock: 6, availableStock: 6, condition: 'good', location: 'HSR Staging Depot', desc: '2000W powered speaker pair with stands and XLR snake.', accent: '#0284C7' },
    { companyId: companyA._id, categoryId: catFurn._id, name: 'Modular Production Lounge Set (4pc)', sku: 'FRN-LNG-12', brand: 'StudioCraft', model: 'SC-Mod4', pricePerDay: 140000, pricePerWeek: 800000, pricePerMonth: 2500000, securityDeposit: 300000, totalStock: 5, availableStock: 2, condition: 'good', location: 'HSR Staging Depot', desc: 'Minimalist boucle sofa + accent chairs for broadcast & keynote stages.', accent: '#7C3AED' },
    { companyId: companyB._id, categoryId: catVehicle._id, name: 'Honda EU30is Silent Inverter Generator', sku: 'IND-GEN-01', brand: 'Honda', model: 'EU30is', pricePerDay: 280000, pricePerWeek: 1650000, pricePerMonth: 5400000, securityDeposit: 800000, totalStock: 5, availableStock: 5, condition: 'excellent', location: 'Mumbai Depot', desc: '3kVA ultra-quiet portable inverter generator for outdoor sites.', accent: '#EA580C' },
    { companyId: companyB._id, categoryId: catVehicle._id, name: 'Bosch GBH 8-45 DV Rotary Hammer', sku: 'IND-DRL-02', brand: 'Bosch', model: 'GBH 8-45 DV', pricePerDay: 95000, pricePerWeek: 550000, pricePerMonth: 1800000, securityDeposit: 250000, totalStock: 9, availableStock: 9, condition: 'good', location: 'Mumbai Depot', desc: 'Heavy-duty SDS-max rotary hammer drill with vibration control.', accent: '#EA580C' },
  ];

  const createdProducts = [];
  for (const p of productSeeds) {
    const imgUrl = createDemoProductSvg(
      `demo-${p.sku.toLowerCase()}.svg`,
      p.name.slice(0, 28),
      p.accent,
      `${p.brand} · ${p.sku}`
    );
    const prod = await Product.create({
      companyId: p.companyId,
      categoryId: p.categoryId,
      name: p.name,
      sku: p.sku,
      description: p.desc,
      images: [imgUrl],
      brand: p.brand,
      model: p.model,
      pricePerDay: p.pricePerDay,
      pricePerWeek: p.pricePerWeek,
      pricePerMonth: p.pricePerMonth,
      securityDeposit: p.securityDeposit,
      totalStock: p.totalStock,
      availableStock: p.availableStock,
      condition: p.condition as 'new' | 'excellent' | 'good',
      location: p.location,
      status: 'active',
      lowStockThreshold: 2,
    });
    createdProducts.push(prod);
  }

  // 7. Sample Bookings, Payments, Invoices, Returns & Deliveries
  const today = new Date();
  const addDays = (d: number) => new Date(today.getTime() + d * 86400000);

  // Completed booking (past) + Return + Verified Review
  const pastRange = normalizeRentalRange(addDays(-12), addDays(-8));
  const fx6 = createdProducts[0];
  const pastSub = fx6.pricePerDay * 2 * pastRange.rentalDays;
  const pastTax = Math.round(pastSub * 0.18);
  const pastTotal = pastSub + pastTax + fx6.securityDeposit * 2;

  const bookingCompleted = await Booking.create({
    bookingReference: 'RF-2026-DEMO01',
    companyId: companyA._id,
    customerId: cust1._id,
    startDate: pastRange.startDate,
    endDate: pastRange.endDate,
    rentalDays: pastRange.rentalDays,
    status: 'completed',
    paymentStatus: 'paid',
    fulfillmentType: 'pickup',
    pricing: {
      rentalDays: pastRange.rentalDays,
      rentalSubtotal: pastSub,
      discountAmount: 0,
      taxableAmount: pastSub,
      taxRate: 18,
      taxInclusive: false,
      taxAmount: pastTax,
      deliveryFee: 0,
      securityDeposit: fx6.securityDeposit * 2,
      lateFeeAmount: 0,
      damageFeeAmount: 0,
      totalAmount: pastTotal,
    },
    statusHistory: [
      { status: 'pending', note: 'Submitted by Priya Nair', changedBy: cust1._id, changedByName: cust1.name, changedAt: addDays(-14) },
      { status: 'paid', note: 'Payment verified', changedBy: cust1._id, changedByName: 'Payment Gateway', changedAt: addDays(-13) },
      { status: 'completed', note: 'Returned in good condition', changedBy: staff1._id, changedByName: staff1.name, changedAt: addDays(-8) },
    ],
  });

  await BookingItem.create({
    bookingId: bookingCompleted._id,
    companyId: companyA._id,
    productId: fx6._id,
    productName: fx6.name,
    productSku: fx6.sku,
    quantity: 2,
    unitDailyPrice: fx6.pricePerDay,
    lineSubtotal: pastSub,
    depositPerUnit: fx6.securityDeposit,
    startDate: pastRange.startDate,
    endDate: pastRange.endDate,
  });

  const pay1 = await Payment.create({
    companyId: companyA._id,
    bookingId: bookingCompleted._id,
    customerId: cust1._id,
    gateway: 'dev_simulator',
    orderId: 'order_sim_demo01',
    paymentId: 'pay_sim_demo01',
    amount: pastTotal,
    currency: 'INR',
    status: 'captured',
    receipt: 'RCPT-RF-2026-DEMO01',
    paidAt: addDays(-13),
  });

  await Invoice.create({
    invoiceNumber: 'INV-2026-DEMO01',
    companyId: companyA._id,
    bookingId: bookingCompleted._id,
    customerId: cust1._id,
    paymentId: pay1._id,
    currency: 'INR',
    currencySymbol: '₹',
    subtotal: pastSub,
    discountAmount: 0,
    taxRate: 18,
    taxAmount: pastTax,
    deliveryFee: 0,
    securityDeposit: fx6.securityDeposit * 2,
    totalAmount: pastTotal,
    status: 'paid',
    issuedAt: addDays(-13),
  });

  await RentalReturn.create({
    companyId: companyA._id,
    bookingId: bookingCompleted._id,
    customerId: cust1._id,
    processedBy: staff1._id,
    expectedReturnDate: pastRange.endDate,
    actualReturnDate: pastRange.endDate,
    returnCondition: 'good',
    lateDays: 0,
    lateFeeAmount: 0,
    damageFeeAmount: 0,
    additionalCharges: 0,
    depositHeld: fx6.securityDeposit * 2,
    depositRefundAmount: fx6.securityDeposit * 2,
    depositRefundStatus: 'refunded',
    putProductsInMaintenance: false,
    status: 'completed',
  });

  await Review.create({
    companyId: companyA._id,
    productId: fx6._id,
    bookingId: bookingCompleted._id,
    customerId: cust1._id,
    rating: 5,
    comment: 'Clean sensor, batteries fully charged, and smooth pickup workflow.',
    verifiedRental: true,
    moderationStatus: 'approved',
  });
  await Product.updateOne({ _id: fx6._id }, { $set: { averageRating: 5, reviewCount: 1 } });

  // Active Rental booking (ongoing now)
  const activeRange = normalizeRentalRange(addDays(-1), addDays(3));
  const mbp = createdProducts[4];
  const actSub = mbp.pricePerDay * 2 * activeRange.rentalDays;
  const actDel = 30000;
  const actTax = Math.round((actSub + actDel) * 0.18);
  const actTotal = actSub + actDel + actTax + mbp.securityDeposit * 2;

  const bookingActive = await Booking.create({
    bookingReference: 'RF-2026-DEMO02',
    companyId: companyA._id,
    customerId: cust2._id,
    startDate: activeRange.startDate,
    endDate: activeRange.endDate,
    rentalDays: activeRange.rentalDays,
    status: 'active_rental',
    paymentStatus: 'paid',
    fulfillmentType: 'delivery',
    deliveryAddress: {
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
      phone: '+91 98222 22222',
    },
    pricing: {
      rentalDays: activeRange.rentalDays,
      rentalSubtotal: actSub,
      discountAmount: 0,
      taxableAmount: actSub + actDel,
      taxRate: 18,
      taxInclusive: false,
      taxAmount: actTax,
      deliveryFee: actDel,
      securityDeposit: mbp.securityDeposit * 2,
      lateFeeAmount: 0,
      damageFeeAmount: 0,
      totalAmount: actTotal,
    },
    statusHistory: [
      { status: 'pending', note: 'Submitted online', changedBy: cust2._id, changedByName: cust2.name, changedAt: addDays(-2) },
      { status: 'paid', note: 'Payment verified', changedBy: cust2._id, changedByName: 'Payment Gateway', changedAt: addDays(-2) },
      { status: 'active_rental', note: 'Delivered to MG Road studio', changedBy: staff2._id, changedByName: staff2.name, changedAt: addDays(-1) },
    ],
  });

  await BookingItem.create({
    bookingId: bookingActive._id,
    companyId: companyA._id,
    productId: mbp._id,
    productName: mbp.name,
    productSku: mbp.sku,
    quantity: 2,
    unitDailyPrice: mbp.pricePerDay,
    lineSubtotal: actSub,
    depositPerUnit: mbp.securityDeposit,
    startDate: activeRange.startDate,
    endDate: activeRange.endDate,
  });

  await Payment.create({
    companyId: companyA._id,
    bookingId: bookingActive._id,
    customerId: cust2._id,
    gateway: 'dev_simulator',
    orderId: 'order_sim_demo02',
    paymentId: 'pay_sim_demo02',
    amount: actTotal,
    currency: 'INR',
    status: 'captured',
    receipt: 'RCPT-RF-2026-DEMO02',
    paidAt: addDays(-2),
  });

  await Invoice.create({
    invoiceNumber: 'INV-2026-DEMO02',
    companyId: companyA._id,
    bookingId: bookingActive._id,
    customerId: cust2._id,
    currency: 'INR',
    currencySymbol: '₹',
    subtotal: actSub,
    discountAmount: 0,
    taxRate: 18,
    taxAmount: actTax,
    deliveryFee: actDel,
    securityDeposit: mbp.securityDeposit * 2,
    totalAmount: actTotal,
    status: 'paid',
    issuedAt: addDays(-2),
  });

  await Delivery.create({
    companyId: companyA._id,
    bookingId: bookingActive._id,
    customerId: cust2._id,
    fulfillmentType: 'delivery',
    status: 'delivered',
    assignedStaffId: staff2._id,
    deliveryCharge: actDel,
    dispatchDate: addDays(-1),
    deliveredAt: addDays(-1),
    address: {
      street: '12 MG Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      country: 'India',
    },
  });

  // Pending booking (upcoming)
  const upcomingRange = normalizeRentalRange(addDays(3), addDays(6));
  const led = createdProducts[7];
  const upSub = led.pricePerDay * 1 * upcomingRange.rentalDays;
  const upTax = Math.round(upSub * 0.18);
  const bookingPending = await Booking.create({
    bookingReference: 'RF-2026-DEMO03',
    companyId: companyA._id,
    customerId: cust3._id,
    startDate: upcomingRange.startDate,
    endDate: upcomingRange.endDate,
    rentalDays: upcomingRange.rentalDays,
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfillmentType: 'pickup',
    pricing: {
      rentalDays: upcomingRange.rentalDays,
      rentalSubtotal: upSub,
      discountAmount: 0,
      taxableAmount: upSub,
      taxRate: 18,
      taxInclusive: false,
      taxAmount: upTax,
      deliveryFee: 0,
      securityDeposit: led.securityDeposit,
      lateFeeAmount: 0,
      damageFeeAmount: 0,
      totalAmount: upSub + upTax + led.securityDeposit,
    },
    statusHistory: [
      { status: 'pending', note: 'Awaiting workspace approval', changedBy: cust3._id, changedByName: cust3.name, changedAt: today },
    ],
  });

  await BookingItem.create({
    bookingId: bookingPending._id,
    companyId: companyA._id,
    productId: led._id,
    productName: led.name,
    productSku: led.sku,
    quantity: 1,
    unitDailyPrice: led.pricePerDay,
    lineSubtotal: upSub,
    depositPerUnit: led.securityDeposit,
    startDate: upcomingRange.startDate,
    endDate: upcomingRange.endDate,
  });

  // Notifications & Support Ticket & Activity Logs
  await Notification.insertMany([
    { userId: ownerA._id, companyId: companyA._id, type: 'NEW_BOOKING', title: 'New Booking RF-2026-DEMO03', message: 'Meera Krishnan submitted a 4-day booking for Aputure 600d Pro LED Light Kit.', link: `/admin/bookings/${bookingPending._id}` },
    { userId: cust1._id, companyId: companyA._id, type: 'RETURN_PROCESSED', title: 'Deposit Refunded — RF-2026-DEMO01', message: 'Your security deposit has been refunded in full.', link: `/customer/bookings/${bookingCompleted._id}` },
  ]);

  await SupportTicket.create({
    ticketNumber: 'TKT-DEMO01',
    companyId: companyA._id,
    customerId: cust2._id,
    category: 'delivery',
    subject: 'Pickup timing coordination for MacBook Pro kit',
    description: 'Can we schedule the return pickup after 5 PM on our end date?',
    status: 'open',
    priority: 'medium',
    messages: [
      { senderId: cust2._id, senderName: cust2.name, senderRole: 'customer', message: 'Can we schedule the return pickup after 5 PM on our end date?', createdAt: today },
    ],
  });

  await ActivityLog.insertMany([
    { companyId: companyA._id, actorId: ownerA._id, actorName: ownerA.name, actorRole: ownerA.role, action: 'PRODUCT_CREATED', resourceType: 'Product', description: 'Seeded 12 rental products for Apex Lens & Tech Rentals' },
    { companyId: companyA._id, actorId: staff1._id, actorName: staff1.name, actorRole: staff1.role, action: 'RETURN_PROCESSED', resourceType: 'RentalReturn', description: 'Completed return inspection for RF-2026-DEMO01' },
  ]);

  console.log('------------------------------------------------');
  console.log('[RentFlow] Demo Seed Complete!');
  console.log(`Super Admin: ${superAdmin.email} / ${superAdminPassword}`);
  console.log('Company A Owner: owner@apexrentals.local / DemoPass!2026');
  console.log('Company A Admin: admin@apexrentals.local / DemoPass!2026');
  console.log('Company A Staff: staff1@apexrentals.local / DemoPass!2026');
  console.log('Company B Owner: owner@urbanfleet.local / DemoPass!2026');
  console.log('Customer Demo:   priya@customer.local / DemoPass!2026');
  console.log('------------------------------------------------');

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('[Seed Error]', err);
  process.exit(1);
});
