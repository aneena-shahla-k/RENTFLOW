import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBookingItem extends Document {
  _id: Types.ObjectId;
  bookingId: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  productSku: string;
  quantity: number;
  unitDailyPrice: number;
  unitWeeklyPrice?: number;
  unitMonthlyPrice?: number;
  lineSubtotal: number;
  depositPerUnit: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

const bookingItemSchema = new Schema<IBookingItem>(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitDailyPrice: { type: Number, required: true, min: 0 },
    unitWeeklyPrice: { type: Number, min: 0 },
    unitMonthlyPrice: { type: Number, min: 0 },
    lineSubtotal: { type: Number, required: true, min: 0 },
    depositPerUnit: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bookingItemSchema.index({ productId: 1, startDate: 1, endDate: 1 });

export const BookingItem = mongoose.model<IBookingItem>('BookingItem', bookingItemSchema);
