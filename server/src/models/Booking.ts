import mongoose, { Document, Schema, Types } from 'mongoose';
import { BookingStatus } from '../types/index.js';

export interface IBookingStatusHistory {
  status: BookingStatus;
  note?: string;
  changedBy?: Types.ObjectId;
  changedByName?: string;
  changedAt: Date;
}

export interface IBookingPricing {
  rentalDays: number;
  rentalSubtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  taxInclusive: boolean;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  lateFeeAmount: number;
  damageFeeAmount: number;
  totalAmount: number;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingReference: string;
  companyId: Types.ObjectId;
  customerId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  rentalDays: number;
  status: BookingStatus;
  paymentStatus: 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: {
    label?: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    lat?: number;
    lng?: number;
  };
  pricing: IBookingPricing;
  notes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  holdExpiresAt?: Date;
  extensionRequested?: {
    requestedEndDate: Date;
    status: 'pending' | 'approved' | 'rejected';
    reason?: string;
    requestedAt: Date;
  };
  statusHistory: IBookingStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingReference: { type: String, required: true, unique: true, uppercase: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    rentalDays: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: [
        'hold',
        'pending',
        'confirmed',
        'payment_pending',
        'paid',
        'ready_for_pickup',
        'out_for_delivery',
        'active_rental',
        'return_requested',
        'returned',
        'completed',
        'cancelled',
        'rejected',
        'overdue',
      ],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'refunded', 'failed'],
      default: 'unpaid',
      index: true,
    },
    fulfillmentType: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup',
    },
    deliveryAddress: {
      label: String,
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String,
      lat: Number,
      lng: Number,
    },
    pricing: {
      rentalDays: { type: Number, required: true },
      rentalSubtotal: { type: Number, required: true },
      discountAmount: { type: Number, default: 0 },
      taxableAmount: { type: Number, required: true },
      taxRate: { type: Number, default: 0 },
      taxInclusive: { type: Boolean, default: false },
      taxAmount: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },
      securityDeposit: { type: Number, default: 0 },
      lateFeeAmount: { type: Number, default: 0 },
      damageFeeAmount: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    rejectionReason: { type: String, trim: true },
    cancellationReason: { type: String, trim: true },
    holdExpiresAt: { type: Date, index: true },
    extensionRequested: {
      requestedEndDate: Date,
      status: { type: String, enum: ['pending', 'approved', 'rejected'] },
      reason: String,
      requestedAt: Date,
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        note: String,
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedByName: String,
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

bookingSchema.index({ companyId: 1, status: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ companyId: 1, createdAt: -1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);
