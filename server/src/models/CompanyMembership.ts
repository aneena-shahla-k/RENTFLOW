import mongoose, { Document, Schema, Types } from 'mongoose';
import { CompanyStaffRole } from '../types/index.js';

export interface ICompanyMembership extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  role: CompanyStaffRole;
  status: 'active' | 'invited' | 'suspended';
  permissions: string[];
  invitedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const companyMembershipSchema = new Schema<ICompanyMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    role: {
      type: String,
      enum: ['company_owner', 'company_admin', 'rental_staff'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'invited', 'suspended'],
      default: 'active',
    },
    permissions: { type: [String], default: [] },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

companyMembershipSchema.index({ userId: 1, companyId: 1 }, { unique: true });
companyMembershipSchema.index({ companyId: 1, status: 1 });

export const CompanyMembership = mongoose.model<ICompanyMembership>(
  'CompanyMembership',
  companyMembershipSchema
);
