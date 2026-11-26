import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProduct {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  categoryId: Types.ObjectId;
  subcategoryId?: Types.ObjectId | null;
  name: string;
  sku: string;
  description: string;
  images: string[];
  brand?: string;
  model?: string;
  pricePerDay: number; // smallest currency unit
  pricePerWeek?: number;
  pricePerMonth?: number;
  securityDeposit: number;
  totalStock: number;
  availableStock: number;
  condition: 'new' | 'excellent' | 'good' | 'fair';
  location?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'archived';
  lowStockThreshold: number;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    subcategoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    sku: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    images: { type: [String], default: [] },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    pricePerDay: { type: Number, required: true, min: 0 },
    pricePerWeek: { type: Number, min: 0 },
    pricePerMonth: { type: Number, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    totalStock: { type: Number, required: true, min: 0 },
    availableStock: { type: Number, required: true, min: 0 },
    condition: {
      type: String,
      enum: ['new', 'excellent', 'good', 'fair'],
      default: 'excellent',
    },
    location: { type: String, trim: true, default: 'Main Warehouse' },
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance', 'archived'],
      default: 'active',
      index: true,
    },
    lowStockThreshold: { type: Number, default: 2, min: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ companyId: 1, sku: 1 }, { unique: true });
productSchema.index({ companyId: 1, status: 1, categoryId: 1 });
productSchema.index({ name: 'text', description: 'text', brand: 'text', sku: 'text' });

export const Product = mongoose.model<IProduct>('Product', productSchema);
