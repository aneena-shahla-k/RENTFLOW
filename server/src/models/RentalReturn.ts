import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRentalReturn extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  processedBy?: Types.ObjectId;
  expectedReturnDate: Date;
  actualReturnDate: Date;
  returnCondition: 'good' | 'minor_wear' | 'damaged' | 'missing_items';
  damageReport?: string;
  missingAccessories?: string;
  lateDays: number;
  lateFeeAmount: number;
  damageFeeAmount: number;
  additionalCharges: number;
  depositHeld: number;
  depositRefundAmount: number;
  depositRefundStatus: 'pending' | 'partial_refund' | 'refunded' | 'forfeited';
  putProductsInMaintenance: boolean;
  status: 'requested' | 'inspected' | 'completed';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const rentalReturnSchema = new Schema<IRentalReturn>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expectedReturnDate: { type: Date, required: true },
    actualReturnDate: { type: Date, required: true },
    returnCondition: {
      type: String,
      enum: ['good', 'minor_wear', 'damaged', 'missing_items'],
      default: 'good',
    },
    damageReport: { type: String, trim: true },
    missingAccessories: { type: String, trim: true },
    lateDays: { type: Number, default: 0, min: 0 },
    lateFeeAmount: { type: Number, default: 0, min: 0 },
    damageFeeAmount: { type: Number, default: 0, min: 0 },
    additionalCharges: { type: Number, default: 0, min: 0 },
    depositHeld: { type: Number, default: 0, min: 0 },
    depositRefundAmount: { type: Number, default: 0, min: 0 },
    depositRefundStatus: {
      type: String,
      enum: ['pending', 'partial_refund', 'refunded', 'forfeited'],
      default: 'pending',
    },
    putProductsInMaintenance: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['requested', 'inspected', 'completed'],
      default: 'completed',
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const RentalReturn = mongoose.model<IRentalReturn>('RentalReturn', rentalReturnSchema);
