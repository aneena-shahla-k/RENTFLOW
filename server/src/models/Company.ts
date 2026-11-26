import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICompanySettings {
  currency: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  taxInclusive: boolean;
  gstNumber?: string;
  deliveryEnabled: boolean;
  defaultDeliveryFee: number; // smallest currency unit
  lateFeePerDayPercent: number;
  securityDepositRequired: boolean;
  cancellationWindowHours: number;
  minRentalDays: number;
  maxRentalDays: number;
  bookingHoldMinutes: number;
  allowExtensions: boolean;
  termsAndConditions?: string;
}

export interface ICompanyAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
}

export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  companyCode: string;
  businessType: string;
  description?: string;
  email: string;
  phone: string;
  website?: string;
  logoUrl?: string;
  address: ICompanyAddress;
  status: 'pending' | 'approved' | 'suspended';
  ownerId: Types.ObjectId;
  onboardingCompleted: boolean;
  onboardingStep: number;
  settings: ICompanySettings;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    companyCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    businessType: { type: String, required: true, trim: true, default: 'General Equipment' },
    description: { type: String, trim: true, maxlength: 1000 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    logoUrl: { type: String },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true, default: 'India' },
      postalCode: { type: String, trim: true },
      lat: { type: Number },
      lng: { type: Number },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended'],
      default: 'approved',
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 1, min: 1, max: 8 },
    settings: {
      currency: { type: String, default: 'INR' },
      currencySymbol: { type: String, default: '₹' },
      taxEnabled: { type: Boolean, default: true },
      taxRate: { type: Number, default: 18, min: 0, max: 50 },
      taxInclusive: { type: Boolean, default: false },
      gstNumber: { type: String, trim: true },
      deliveryEnabled: { type: Boolean, default: true },
      defaultDeliveryFee: { type: Number, default: 25000, min: 0 }, // ₹250.00
      lateFeePerDayPercent: { type: Number, default: 25, min: 0, max: 200 },
      securityDepositRequired: { type: Boolean, default: true },
      cancellationWindowHours: { type: Number, default: 24, min: 0 },
      minRentalDays: { type: Number, default: 1, min: 1 },
      maxRentalDays: { type: Number, default: 90, min: 1 },
      bookingHoldMinutes: { type: Number, default: 15, min: 5, max: 120 },
      allowExtensions: { type: Boolean, default: true },
      termsAndConditions: {
        type: String,
        default:
          'Renters are responsible for returning equipment in original condition on or before the agreed return date.',
      },
    },
  },
  { timestamps: true }
);

companySchema.index({ status: 1 });
companySchema.index({ ownerId: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
