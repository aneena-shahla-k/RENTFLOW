import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  companyId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  paymentId?: Types.ObjectId;
  currency: string;
  currencySymbol: string;
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  deliveryFee: number;
  securityDeposit: number;
  lateFeeAmount: number;
  damageFeeAmount: number;
  totalAmount: number;
  status: 'issued' | 'paid' | 'void';
  issuedAt: Date;
  createdAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    currency: { type: String, default: 'INR' },
    currencySymbol: { type: String, default: '₹' },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    securityDeposit: { type: Number, default: 0 },
    lateFeeAmount: { type: Number, default: 0 },
    damageFeeAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['issued', 'paid', 'void'], default: 'paid' },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
