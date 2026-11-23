import type { Request, Response } from 'express';
import { Complaint, toPublicComplaint } from '../models/Complaint';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { env } from '../config/env';
import { sendEmail } from '../services/notificationService';
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

  // Notify admin alarm / in-app notifications
  try {
    await Notification.create({
      recipientRole: 'admin',
      title: `Contact Message: ${contact.name}`,
      message: `${contact.name} (${contact.email}) sent a message under ${category}: "${message.slice(0, 160)}${message.length > 160 ? '...' : ''}"`,
      tone: 'info',
      link: '/admin/dashboard',
    });
  } catch (err) {
    logger.error('Failed to create admin notification for contact message', { error: err });
  }

  // Send email to admin
  if (env.MAIL_FROM_EMAIL) {
    sendEmail({
      to: env.MAIL_FROM_EMAIL,
      subject: `[Contact Form] Message from ${contact.name} (${category})`,
      text: `Name: ${contact.name}\nEmail: ${contact.email}\nPhone: ${contact.phone || 'N/A'}\nCategory: ${category}\nOrder Ref: ${orderReference || 'N/A'}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #14532d;">New Contact Inquiry Received</h2>
          <p><strong>From:</strong> ${contact.name} (${contact.email})</p>
          <p><strong>Phone:</strong> ${contact.phone || 'N/A'}</p>
          <p><strong>Category:</strong> ${category}</p>
          ${orderReference ? `<p><strong>Order Reference:</strong> ${orderReference}</p>` : ''}
          <div style="background-color: #f5f5f4; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="white-space: pre-wrap; margin: 0;">${message}</p>
          </div>
          <p style="margin-top: 24px;"><a href="${env.PUBLIC_APP_URL}/admin/dashboard" style="background-color: #15803d; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px;">Open Admin Console</a></p>
        </div>
      `,
    }).catch((err) => {
      logger.error('Failed to send contact notification email to admin', { error: err });
    });
  }

  logger.info('Support complaint received', { id: complaint.id, category, signedIn: Boolean(req.user) });
  sendSuccess(res, { complaint: toPublicComplaint(complaint) }, 201);
}

export async function listMyComplaints(req: Request, res: Response): Promise<void> {
  const complaints = await Complaint.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).limit(20);
  sendSuccess(res, { complaints: complaints.map(toPublicComplaint) });
}
