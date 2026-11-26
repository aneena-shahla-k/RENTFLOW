import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMaintenancePeriod extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  productId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  quantityBlocked: number;
  reason: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const maintenancePeriodSchema = new Schema<IMaintenancePeriod>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    quantityBlocked: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

maintenancePeriodSchema.index({ productId: 1, status: 1, startDate: 1, endDate: 1 });

export const MaintenancePeriod = mongoose.model<IMaintenancePeriod>(
  'MaintenancePeriod',
  maintenancePeriodSchema
);
