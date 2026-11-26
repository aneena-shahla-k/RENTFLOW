import mongoose, { Document, Schema, Types } from 'mongoose';
import { SubscriptionPlanId } from '../types/index.js';

export interface IBillingRecord {
  invoiceRef: string;
  plan: SubscriptionPlanId;
  billingCycle: 'monthly' | 'annual';
  amountInSmallestUnit: number;
  status: 'paid' | 'pending' | 'failed';
  mode: 'dev_simulated' | 'live';
  paidAt: Date;
}

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  plan: SubscriptionPlanId;
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  mode: 'dev_simulated' | 'live';
  billingCycle: 'monthly' | 'annual';
  priceInSmallestUnit: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingHistory: IBillingRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const billingRecordSchema = new Schema<IBillingRecord>(
  {
    invoiceRef: { type: String, required: true },
    plan: { type: String, enum: ['starter', 'professional', 'business'], required: true },
    billingCycle: { type: String, enum: ['monthly', 'annual'], required: true },
    amountInSmallestUnit: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'pending', 'failed'], default: 'paid' },
    mode: { type: String, enum: ['dev_simulated', 'live'], default: 'dev_simulated' },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const subscriptionSchema = new Schema<ISubscription>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    plan: {
      type: String,
      enum: ['starter', 'professional', 'business'],
      default: 'starter',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'cancelled'],
      default: 'trialing',
    },
    mode: {
      type: String,
      enum: ['dev_simulated', 'live'],
      default: 'dev_simulated',
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'annual'],
      default: 'monthly',
    },
    priceInSmallestUnit: { type: Number, default: 199900 },
    currentPeriodStart: { type: Date, default: Date.now },
    currentPeriodEnd: {
      type: Date,
      default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    billingHistory: { type: [billingRecordSchema], default: [] },
  },
  { timestamps: true }
);

subscriptionSchema.index({ plan: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
