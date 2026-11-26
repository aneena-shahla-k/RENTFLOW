import { Types } from 'mongoose';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { renderRentFlowEmailTemplate, sendEmail } from './email.service.js';

export async function notifyUser(params: {
  userId: Types.ObjectId | string;
  companyId?: Types.ObjectId | string;
  type: string;
  title: string;
  message: string;
  link?: string;
  sendEmailNotification?: boolean;
}): Promise<void> {
  try {
    await Notification.create({
      userId: params.userId,
      companyId: params.companyId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    });

    if (params.sendEmailNotification) {
      const user = await User.findById(params.userId).select('email name');
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: `RentFlow — ${params.title}`,
          html: renderRentFlowEmailTemplate({
            title: params.title,
            bodyHtml: `<p>Hi ${user.name},</p><p>${params.message}</p>`,
          }),
        });
      }
    }
  } catch (err) {
    console.error('[NotificationService] Failed to notify user:', (err as Error).message);
  }
}

export async function notifyCompanyAdmins(params: {
  companyId: Types.ObjectId | string;
  type: string;
  title: string;
  message: string;
  link?: string;
  sendEmailNotification?: boolean;
}): Promise<void> {
  try {
    const memberships = await CompanyMembership.find({
      companyId: params.companyId,
      status: 'active',
      role: { $in: ['company_owner', 'company_admin'] },
    });

    await Promise.all(
      memberships.map((m) =>
        notifyUser({
          userId: m.userId,
          companyId: params.companyId,
          type: params.type,
          title: params.title,
          message: params.message,
          link: params.link,
          sendEmailNotification: params.sendEmailNotification,
        })
      )
    );
  } catch (err) {
    console.error('[NotificationService] Failed to notify company admins:', (err as Error).message);
  }
}
