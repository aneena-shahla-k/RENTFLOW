import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  companyId?: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ companyId: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);
