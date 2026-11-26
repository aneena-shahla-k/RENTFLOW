import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomerAddress extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerAddressSchema = new Schema<ICustomerAddress>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    label: { type: String, required: true, trim: true, default: 'Home' },
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true, default: 'India' },
    postalCode: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    lat: { type: Number },
    lng: { type: Number },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CustomerAddress = mongoose.model<ICustomerAddress>(
  'CustomerAddress',
  customerAddressSchema
);
