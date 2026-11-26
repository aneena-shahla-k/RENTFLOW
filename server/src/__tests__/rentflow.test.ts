process.env.NODE_ENV = 'test';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Booking } from '../models/Booking.js';
import { BookingItem } from '../models/BookingItem.js';
import { Category } from '../models/Category.js';
import { Company } from '../models/Company.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Delivery } from '../models/Delivery.js';
import { Invoice } from '../models/Invoice.js';
import { MaintenancePeriod } from '../models/MaintenancePeriod.js';
import { Notification } from '../models/Notification.js';
import { Payment } from '../models/Payment.js';
import { Product } from '../models/Product.js';
import { RentalReturn } from '../models/RentalReturn.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { computeDevSimulatorSignature } from '../services/payment.service.js';

const app = createApp();

async function clearTestCollections() {
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
    MaintenancePeriod.deleteMany({}),
    ActivityLog.deleteMany({}),
  ]);
}

async function registerCompany(name: string, email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      accountType: 'company',
      ownerName: `${name} Owner`,
      companyName: name,
      email,
      phone: '+91 9876543210',
      password: 'Password123',
      confirmPassword: 'Password123',
      businessType: 'Cameras & Photography Equipment',
      businessAddress: {
        street: '100 Main St',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560001',
      },
    });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.accessToken as string,
    companyId: res.body.data.company._id as string,
    userId: res.body.data.user.id as string,
  };
}

async function registerCustomer(name: string, email: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      accountType: 'customer',
      name,
      email,
      phone: '+91 9811111111',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
  expect(res.status).toBe(201);
  return {
    token: res.body.data.accessToken as string,
    userId: res.body.data.user.id as string,
  };
}

async function createCategoryAndProduct(
  token: string,
  opts: { name?: string; sku?: string; totalStock?: number; pricePerDay?: number } = {}
) {
  const catRes = await request(app)
    .post('/api/categories')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
  expect(catRes.status).toBe(201);
  const categoryId = catRes.body.data._id as string;

  const prodRes = await request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: opts.name || 'Cinema Camera FX6',
      sku: opts.sku || `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      categoryId,
      description: 'Professional cinema camera kit for testing.',
      pricePerDay: opts.pricePerDay ?? 100000, // ₹1,000/day
      securityDeposit: 500000, // ₹5,000
      totalStock: opts.totalStock ?? 10,
      status: 'active',
    });
  expect(prodRes.status).toBe(201);
  return prodRes.body.data;
}

describe('RentFlow Core Business & Security Suite', () => {
  beforeAll(async () => {
    await connectDatabase(process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/rentflow_test');
  });

  beforeEach(async () => {
    await clearTestCollections();
  });

  afterAll(async () => {
    await clearTestCollections();
    await disconnectDatabase();
  });

  describe('1. Authentication & Role Permissions', () => {
    it('supports valid login, rejects invalid password, and enforces protected route & role permissions', async () => {
      await registerCustomer('Priya Nair', 'priya@test.local');

      const validLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'priya@test.local', password: 'Password123' });
      expect(validLogin.status).toBe(200);
      expect(validLogin.body.data.accessToken).toBeTruthy();

      const customerToken = validLogin.body.data.accessToken;

      const invalidLogin = await request(app)
        .post('/api/auth/login')
        .send({ email: 'priya@test.local', password: 'WrongPassword1' });
      expect(invalidLogin.status).toBe(401);

      const unauthRes = await request(app).get('/api/dashboard/admin');
      expect(unauthRes.status).toBe(401);

      const forbiddenAdmin = await request(app)
        .get('/api/dashboard/admin')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(forbiddenAdmin.status).toBe(403);

      const forbiddenSuper = await request(app)
        .get('/api/superadmin/overview')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(forbiddenSuper.status).toBe(403);
    });
  });

  describe('2. Multi-Tenant Data Isolation', () => {
    it('prevents Company A from viewing or modifying Company B products and bookings', async () => {
      const compA = await registerCompany('Company Alpha', 'alpha@test.local');
      const compB = await registerCompany('Company Beta', 'beta@test.local');
      const customer = await registerCustomer('Customer One', 'cust1@test.local');

      const prodB = await createCategoryAndProduct(compB.token, { name: 'Beta Generator', sku: 'BETA-01' });

      // Customer books Company B's product
      const bookingBRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customer.token}`)
        .send({
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          items: [{ productId: prodB._id, quantity: 1 }],
          fulfillmentType: 'pickup',
        });
      expect(bookingBRes.status).toBe(201);
      const bookingBId = bookingBRes.body.data.booking._id;

      // Company A lists products -> must NOT include Beta Generator
      const listProdA = await request(app)
        .get('/api/products')
        .set('Authorization', `Bearer ${compA.token}`);
      expect(listProdA.status).toBe(200);
      expect(listProdA.body.data.items).toHaveLength(0);

      // Company A tries to read/patch/delete Company B product by ID -> 404
      const getProdBAsA = await request(app)
        .get(`/api/products/${prodB._id}`)
        .set('Authorization', `Bearer ${compA.token}`);
      expect(getProdBAsA.status).toBe(404);

      const patchProdBAsA = await request(app)
        .patch(`/api/products/${prodB._id}`)
        .set('Authorization', `Bearer ${compA.token}`)
        .send({ name: 'Hijacked' });
      expect(patchProdBAsA.status).toBe(404);

      // Company A lists bookings -> must NOT include Company B booking
      const listBookingsA = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${compA.token}`);
      expect(listBookingsA.status).toBe(200);
      expect(listBookingsA.body.data.items).toHaveLength(0);

      // Company A tries to access or mutate Company B booking by ID -> 404
      const getBookingBAsA = await request(app)
        .get(`/api/bookings/${bookingBId}`)
        .set('Authorization', `Bearer ${compA.token}`);
      expect(getBookingBAsA.status).toBe(404);

      const statusBookingBAsA = await request(app)
        .patch(`/api/bookings/${bookingBId}/status`)
        .set('Authorization', `Bearer ${compA.token}`)
        .send({ status: 'confirmed' });
      expect(statusBookingBAsA.status).toBe(404);
    });
  });

  describe('3. Rental Availability & Booking Engine', () => {
    it('validates available stock, rejects overlapping overbooking, allows non-overlapping bookings, releases expired holds, and handles simultaneous requests safely', async () => {
      const comp = await registerCompany('Camera Co', 'cam@test.local');
      const cust1 = await registerCustomer('C1', 'c1@test.local');
      const cust2 = await registerCustomer('C2', 'c2@test.local');

      const camera = await createCategoryAndProduct(comp.token, {
        name: 'Sony FX6',
        sku: 'FX6-10',
        totalStock: 10,
      });

      // Booking A: Jan 1-5, Qty 4
      const bA = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust1.token}`)
        .send({
          startDate: '2027-01-01',
          endDate: '2027-01-05',
          items: [{ productId: camera._id, quantity: 4 }],
          fulfillmentType: 'pickup',
        });
      expect(bA.status).toBe(201);

      // Booking B: Jan 3-6, Qty 5 (total 9 on Jan 3-5 <= 10 -> succeeds)
      const bB = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust2.token}`)
        .send({
          startDate: '2027-01-03',
          endDate: '2027-01-06',
          items: [{ productId: camera._id, quantity: 5 }],
          fulfillmentType: 'pickup',
        });
      expect(bB.status).toBe(201);

      // Booking C: Jan 3-6, Qty 2 (would require 11 > 10 -> MUST be rejected with 409)
      const bC = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust1.token}`)
        .send({
          startDate: '2027-01-03',
          endDate: '2027-01-06',
          items: [{ productId: camera._id, quantity: 2 }],
          fulfillmentType: 'pickup',
        });
      expect(bC.status).toBe(409);

      // Non-overlapping Booking D: Jan 7-10, Qty 8 -> succeeds!
      const bD = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust1.token}`)
        .send({
          startDate: '2027-01-07',
          endDate: '2027-01-10',
          items: [{ productId: camera._id, quantity: 8 }],
          fulfillmentType: 'pickup',
        });
      expect(bD.status).toBe(201);

      // Expired Hold test: create a temporary hold for Feb 1-3 qty 6, force expire it, then verify qty 6 is available again
      const holdRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust1.token}`)
        .send({
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          items: [{ productId: camera._id, quantity: 6 }],
          fulfillmentType: 'pickup',
          asHold: true,
        });
      expect(holdRes.status).toBe(201);
      const holdBookingId = holdRes.body.data.booking._id;

      // Expire the hold in DB
      await Booking.updateOne(
        { _id: holdBookingId },
        { $set: { holdExpiresAt: new Date(Date.now() - 60_000) } }
      );

      // Now request qty 6 on Feb 1-3 -> expired hold releases automatically and succeeds!
      const afterHoldRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust2.token}`)
        .send({
          startDate: '2027-02-01',
          endDate: '2027-02-03',
          items: [{ productId: camera._id, quantity: 6 }],
          fulfillmentType: 'pickup',
        });
      expect(afterHoldRes.status).toBe(201);

      // Simultaneous booking race test: two parallel requests each asking for 6 units on Mar 1-3 (stock = 10)
      const [sim1, sim2] = await Promise.all([
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${cust1.token}`)
          .send({
            startDate: '2027-03-01',
            endDate: '2027-03-03',
            items: [{ productId: camera._id, quantity: 6 }],
            fulfillmentType: 'pickup',
          }),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${cust2.token}`)
          .send({
            startDate: '2027-03-01',
            endDate: '2027-03-03',
            items: [{ productId: camera._id, quantity: 6 }],
            fulfillmentType: 'pickup',
          }),
      ]);

      const statuses = [sim1.status, sim2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });
  });

  describe('4. Payment Signature Verification & Idempotency', () => {
    it('rejects invalid signature, accepts valid signature, and handles duplicate callbacks idempotently', async () => {
      const comp = await registerCompany('Pay Co', 'pay@test.local');
      const cust = await registerCustomer('Payer', 'payer@test.local');
      const prod = await createCategoryAndProduct(comp.token, { totalStock: 5 });

      const bkRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          startDate: '2027-04-01',
          endDate: '2027-04-02',
          items: [{ productId: prod._id, quantity: 1 }],
          fulfillmentType: 'pickup',
        });
      const bookingId = bkRes.body.data.booking._id;

      const orderRes = await request(app)
        .post('/api/payments/create-order')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({ bookingId });
      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.orderId as string;

      // 1. Invalid signature must fail
      const badVerify = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          orderId,
          paymentId: 'pay_test_1',
          signature: 'tampered_bad_signature',
        });
      expect(badVerify.status).toBe(400);

      // 2. Valid signature succeeds
      const validSig = computeDevSimulatorSignature(orderId, 'pay_test_1');
      const goodVerify = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          orderId,
          paymentId: 'pay_test_1',
          signature: validSig,
        });
      expect(goodVerify.status).toBe(200);
      expect(goodVerify.body.data.alreadyProcessed).toBe(false);
      expect(goodVerify.body.data.booking.paymentStatus).toBe('paid');
      expect(goodVerify.body.data.invoice.invoiceNumber).toBeTruthy();

      // 3. Duplicate callback returns idempotently
      const dupVerify = await request(app)
        .post('/api/payments/verify')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          orderId,
          paymentId: 'pay_test_1',
          signature: validSig,
        });
      expect(dupVerify.status).toBe(200);
      expect(dupVerify.body.data.alreadyProcessed).toBe(true);
    });
  });

  describe('5. Rental Return Management (Normal, Late, Damaged)', () => {
    it('processes normal return, late return with late fee deduction, and damaged product maintenance lock', async () => {
      const comp = await registerCompany('Return Co', 'ret@test.local');
      const cust = await registerCustomer('Renter', 'renter@test.local');
      const prod = await createCategoryAndProduct(comp.token, {
        totalStock: 2,
        pricePerDay: 100000, // ₹1,000/day
      });

      // Normal return
      const b1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          startDate: '2027-05-01',
          endDate: '2027-05-02',
          items: [{ productId: prod._id, quantity: 1 }],
          fulfillmentType: 'pickup',
        });
      const b1Id = b1.body.data.booking._id;

      await request(app)
        .patch(`/api/bookings/${b1Id}/status`)
        .set('Authorization', `Bearer ${comp.token}`)
        .send({ status: 'active_rental' });

      const normalRet = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${comp.token}`)
        .send({
          bookingId: b1Id,
          actualReturnDate: '2027-05-02',
          returnCondition: 'good',
        });
      expect(normalRet.status).toBe(201);
      expect(normalRet.body.data.lateDays).toBe(0);
      expect(normalRet.body.data.depositRefundAmount).toBe(500000);

      // Late return (2 days late)
      const b2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          startDate: '2027-06-01',
          endDate: '2027-06-02',
          items: [{ productId: prod._id, quantity: 1 }],
          fulfillmentType: 'pickup',
        });
      const b2Id = b2.body.data.booking._id;

      const lateRet = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${comp.token}`)
        .send({
          bookingId: b2Id,
          actualReturnDate: '2027-06-04',
          returnCondition: 'minor_wear',
        });
      expect(lateRet.status).toBe(201);
      expect(lateRet.body.data.lateDays).toBe(2);
      expect(lateRet.body.data.lateFeeAmount).toBeGreaterThan(0);
      expect(lateRet.body.data.depositRefundAmount).toBeLessThan(500000);

      // Damaged return -> must block damaged units in MaintenancePeriod and NOT allow immediate rebooking
      const b3 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          startDate: '2027-07-01',
          endDate: '2027-07-02',
          items: [{ productId: prod._id, quantity: 2 }],
          fulfillmentType: 'pickup',
        });
      const b3Id = b3.body.data.booking._id;

      const dmgRet = await request(app)
        .post('/api/returns')
        .set('Authorization', `Bearer ${comp.token}`)
        .send({
          bookingId: b3Id,
          actualReturnDate: '2027-07-02',
          returnCondition: 'damaged',
          damageReport: 'Broken tripod mount',
          damageFeeAmount: 200000,
          putProductsInMaintenance: true,
        });
      expect(dmgRet.status).toBe(201);
      expect(dmgRet.body.data.putProductsInMaintenance).toBe(true);

      // Attempting to book all 2 units right after on July 3-4 must be rejected because product is in maintenance!
      const postDmgBook = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${cust.token}`)
        .send({
          startDate: '2027-07-03',
          endDate: '2027-07-04',
          items: [{ productId: prod._id, quantity: 1 }],
          fulfillmentType: 'pickup',
        });
      expect(postDmgBook.status).toBe(409);
    });
  });
});
