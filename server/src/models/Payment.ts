import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  gateway: 'razorpay' | 'dev_simulator';
  orderId: string;
  paymentId?: string;
  signature?: string;
  amount: number; // smallest currency unit
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  receipt: string;
  failureReason?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gateway: { type: String, enum: ['razorpay', 'dev_simulator'], required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, sparse: true },
    signature: { type: String, select: false },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    receipt: { type: String, required: true },
    failureReason: { type: String },
    paidAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ companyId: 1, createdAt: -1 });

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
