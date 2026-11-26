import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  rating: number;
  comment: string;
  verifiedRental: boolean;
  moderationStatus: 'approved' | 'pending' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1500 },
    verifiedRental: { type: Boolean, default: true },
    moderationStatus: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved',
    },
  },
  { timestamps: true }
);

reviewSchema.index({ bookingId: 1, productId: 1, customerId: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);
