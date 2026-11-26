import mongoose, { Document, Schema, Types } from 'mongoose';

export type DeliveryStatus =
  | 'pending'
  | 'preparing'
  | 'dispatched'
  | 'delivered'
  | 'pickup_scheduled'
  | 'collected';

export interface IDelivery extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  fulfillmentType: 'pickup' | 'delivery';
  status: DeliveryStatus;
  assignedStaffId?: Types.ObjectId;
  deliveryCharge: number;
  dispatchDate?: Date;
  expectedDeliveryDate?: Date;
  deliveredAt?: Date;
  confirmationNote?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const deliverySchema = new Schema<IDelivery>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fulfillmentType: { type: String, enum: ['pickup', 'delivery'], required: true },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'dispatched', 'delivered', 'pickup_scheduled', 'collected'],
      default: 'pending',
      index: true,
    },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: 'User' },
    deliveryCharge: { type: Number, default: 0, min: 0 },
    dispatchDate: { type: Date },
    expectedDeliveryDate: { type: Date },
    deliveredAt: { type: Date },
    confirmationNote: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      phone: String,
    },
  },
  { timestamps: true }
);

export const Delivery = mongoose.model<IDelivery>('Delivery', deliverySchema);
