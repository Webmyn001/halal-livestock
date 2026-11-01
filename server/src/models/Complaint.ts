import { Schema, model, type HydratedDocument } from 'mongoose';

export const COMPLAINT_CATEGORIES = [
  'listing_quality',
  'payment',
  'delivery',
  'account',
  'farmer_conduct',
  'other',
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_STATUSES = ['open', 'under_review', 'resolved', 'closed'] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export interface IComplaint {
  /** Present when the reporter was signed in. Guest reports keep only the contact details. */
  userId?: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhone?: string;
  category: ComplaintCategory;
  message: string;
  orderReference?: string;
  status: ComplaintStatus;
  adminResponse?: string;
  handledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ComplaintDoc = HydratedDocument<IComplaint>;

const complaintSchema = new Schema<IComplaint>(
  {
    userId: { type: String, index: true },
    reporterName: { type: String, required: true, trim: true, maxlength: 120 },
    reporterEmail: { type: String, required: true, lowercase: true, trim: true },
    reporterPhone: { type: String, trim: true },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    message: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    orderReference: { type: String, trim: true, maxlength: 40 },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'open', index: true },
    adminResponse: { type: String, trim: true, maxlength: 2000 },
    handledAt: Date,
  },
  { timestamps: true }
);

complaintSchema.index({ createdAt: -1 });

export function toPublicComplaint(complaint: ComplaintDoc) {
  return {
    id: complaint.id,
    category: complaint.category,
    message: complaint.message,
    orderReference: complaint.orderReference,
    status: complaint.status,
    adminResponse: complaint.adminResponse,
    createdAt: complaint.createdAt,
    handledAt: complaint.handledAt,
  };
}

export const Complaint = model<IComplaint>('Complaint', complaintSchema);
