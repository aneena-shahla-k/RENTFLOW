import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICategory extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  parentId?: Types.ObjectId | null;
  icon?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    icon: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ companyId: 1, slug: 1 }, { unique: true });
categorySchema.index({ companyId: 1, parentId: 1, active: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
