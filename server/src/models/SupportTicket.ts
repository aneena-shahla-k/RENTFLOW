import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITicketMessage {
  senderId: Types.ObjectId;
  senderName: string;
  senderRole: string;
  message: string;
  attachmentUrl?: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  ticketNumber: string;
  companyId?: Types.ObjectId;
  customerId: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  category: 'booking' | 'payment' | 'equipment' | 'delivery' | 'account' | 'other';
  subject: string;
  description: string;
  attachmentUrl?: string;
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  messages: ITicketMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true, uppercase: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    category: {
      type: String,
      enum: ['booking', 'payment', 'equipment', 'delivery', 'account', 'other'],
      default: 'other',
    },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    attachmentUrl: { type: String },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    messages: [
      {
        senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        senderName: { type: String, required: true },
        senderRole: { type: String, required: true },
        message: { type: String, required: true },
        attachmentUrl: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);
