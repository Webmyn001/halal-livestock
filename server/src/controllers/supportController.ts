import type { Request, Response } from 'express';
import { Complaint, toPublicComplaint } from '../models/Complaint';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { sendSuccess } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import type { CreateComplaintInput } from '../validation/complaintSchemas';

export async function createComplaint(req: Request, res: Response): Promise<void> {
  const { category, message, orderReference, reporterName, reporterEmail, reporterPhone } =
    req.body as CreateComplaintInput;

  let contact = { name: reporterName, email: reporterEmail, phone: reporterPhone };

  if (req.user) {
    // Reports from a signed-in account always carry the account's own contact details, so the
    // thread can be traced back to a real user instead of whatever was typed into the form.
    const account = await User.findById(req.user.userId).select('fullName email phoneNumber').lean();
    if (!account) throw ApiError.unauthorized('This account no longer exists');
    contact = { name: account.fullName, email: account.email, phone: account.phoneNumber };
  } else if (!contact.name || !contact.email) {
    throw ApiError.badRequest('Add your name and email so we can reply', [
      ...(contact.name ? [] : [{ field: 'reporterName', message: 'Enter your full name' }]),
      ...(contact.email ? [] : [{ field: 'reporterEmail', message: 'Enter your email address' }]),
    ]);
  }

  const complaint = await Complaint.create({
    userId: req.user?.userId,
    reporterName: contact.name,
    reporterEmail: contact.email,
    reporterPhone: contact.phone,
    category,
    message,
    orderReference: orderReference || undefined,
  });

  logger.info('Support complaint received', { id: complaint.id, category, signedIn: Boolean(req.user) });
  sendSuccess(res, { complaint: toPublicComplaint(complaint) }, 201);
}

export async function listMyComplaints(req: Request, res: Response): Promise<void> {
  const complaints = await Complaint.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).limit(20);
  sendSuccess(res, { complaints: complaints.map(toPublicComplaint) });
}
