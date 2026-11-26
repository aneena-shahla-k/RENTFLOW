import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Response } from 'express';
import { Company } from '../models/Company.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { logActivity } from '../services/activity.service.js';
import { renderRentFlowEmailTemplate, sendEmail } from '../services/email.service.js';
import { uploadImageBuffer } from '../services/storage.service.js';
import { AuthRequest, SUBSCRIPTION_PLANS } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

export async function createCompany(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');

  const existingMembership = await CompanyMembership.findOne({
    userId: req.user._id,
    status: 'active',
  });
  if (existingMembership) {
    throw new AppError('User already belongs to a company workspace.', 409, 'COMPANY_EXISTS');
  }

  const slug = `${req.body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}-${crypto.randomBytes(2).toString('hex')}`;
  const companyCode = `RF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const company = await Company.create({
    ...req.body,
    slug,
    companyCode,
    ownerId: req.user._id,
    status: 'approved',
  });

  await CompanyMembership.create({
    userId: req.user._id,
    companyId: company._id,
    role: 'company_owner',
    status: 'active',
    permissions: ['*'],
  });

  await User.updateOne({ _id: req.user._id }, { $set: { role: 'company_owner' } });

  await Subscription.create({
    companyId: company._id,
    plan: 'starter',
    status: 'trialing',
    mode: 'dev_simulated',
    billingCycle: 'monthly',
    priceInSmallestUnit: SUBSCRIPTION_PLANS.starter.monthlyPriceInSmallestUnit,
  });

  res.status(201).json({
    success: true,
    message: 'Company workspace created.',
    data: company,
  });
}

export async function getMyCompany(req: AuthRequest, res: Response): Promise<void> {
  const company = await Company.findById(req.companyId);
  if (!company) {
    throw new AppError('Company workspace not found.', 404, 'COMPANY_NOT_FOUND');
  }
  const subscription = await Subscription.findOne({ companyId: company._id });

  res.json({
    success: true,
    data: {
      company,
      subscription,
    },
  });
}

export async function updateMyCompany(req: AuthRequest, res: Response): Promise<void> {
  if (!['company_owner', 'company_admin'].includes(req.user?.companyRole || '')) {
    throw new AppError('Only Company Owners or Admins can update company settings.', 403, 'FORBIDDEN');
  }

  const company = await Company.findById(req.companyId);
  if (!company) {
    throw new AppError('Company workspace not found.', 404, 'COMPANY_NOT_FOUND');
  }

  const { address, settings, ...topLevel } = req.body;

  Object.assign(company, topLevel);
  if (address) {
    company.address = { ...company.address, ...address };
  }
  if (settings) {
    company.settings = { ...company.settings, ...settings };
  }

  await company.save();

  await logActivity({
    companyId: company._id,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'COMPANY_UPDATED',
    resourceType: 'Company',
    resourceId: company._id.toString(),
    description: `Updated workspace settings for ${company.name}`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Company settings updated successfully.',
    data: company,
  });
}

export async function uploadCompanyLogo(req: AuthRequest, res: Response): Promise<void> {
  if (!['company_owner', 'company_admin'].includes(req.user?.companyRole || '')) {
    throw new AppError('Only Company Owners or Admins can update company logo.', 403, 'FORBIDDEN');
  }
  if (!req.file) {
    throw new AppError('Please select an image file to upload.', 400, 'NO_FILE');
  }

  const { url } = await uploadImageBuffer(
    req.file.buffer,
    req.file.mimetype,
    `rentflow/companies/${req.companyId}`
  );

  const company = await Company.findByIdAndUpdate(
    req.companyId,
    { $set: { logoUrl: url } },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Company logo uploaded.',
    data: { logoUrl: url, company },
  });
}

export async function listPublicCompanies(_req: AuthRequest, res: Response): Promise<void> {
  const companies = await Company.find({ status: 'approved' })
    .select('name slug companyCode businessType logoUrl address.city address.state settings.currency settings.currencySymbol settings.deliveryEnabled settings.defaultDeliveryFee settings.taxEnabled settings.taxRate settings.taxInclusive')
    .sort({ name: 1 });

  res.json({
    success: true,
    data: companies,
  });
}

export async function listStaff(req: AuthRequest, res: Response): Promise<void> {
  const memberships = await CompanyMembership.find({ companyId: req.companyId })
    .populate('userId', 'name email phone role active lastLoginAt createdAt')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: memberships,
  });
}

export async function inviteStaff(req: AuthRequest, res: Response): Promise<void> {
  if (!['company_owner', 'company_admin'].includes(req.user?.companyRole || '')) {
    throw new AppError('Only Company Owners or Admins can invite staff members.', 403, 'FORBIDDEN');
  }

  const { name, email, phone, role, password } = req.body;

  // Enforce subscription staff limit
  const subscription = await Subscription.findOne({ companyId: req.companyId });
  const planId = subscription?.plan || 'starter';
  const maxStaff = SUBSCRIPTION_PLANS[planId].limits.maxStaff;
  const currentStaffCount = await CompanyMembership.countDocuments({
    companyId: req.companyId,
    status: 'active',
  });

  if (currentStaffCount >= maxStaff) {
    throw new AppError(
      `Your ${SUBSCRIPTION_PLANS[planId].name} plan allows up to ${maxStaff} team members. Upgrade to invite more staff.`,
      403,
      'PLAN_LIMIT_REACHED'
    );
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const existingMember = await CompanyMembership.findOne({
      userId: existingUser._id,
      companyId: req.companyId,
    });
    if (existingMember) {
      throw new AppError('This user is already a member of your company.', 409, 'ALREADY_MEMBER');
    }
    throw new AppError(
      'An account with this email already exists in RentFlow.',
      409,
      'EMAIL_EXISTS'
    );
  }

  const tempPassword = password || `RfStaff!${crypto.randomBytes(4).toString('hex')}`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const staffUser = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role,
    isEmailVerified: true,
  });

  const membership = await CompanyMembership.create({
    userId: staffUser._id,
    companyId: req.companyId,
    role,
    status: 'active',
    permissions: role === 'company_admin' ? ['manage_all'] : ['manage_bookings', 'manage_returns'],
    invitedBy: req.user!._id,
  });

  const company = await Company.findById(req.companyId);

  await sendEmail({
    to: staffUser.email,
    subject: `You were invited to join ${company?.name || 'RentFlow'}`,
    html: renderRentFlowEmailTemplate({
      title: `Welcome to ${company?.name || 'RentFlow'}`,
      bodyHtml: `<p><strong>${req.user!.name}</strong> invited you to join <strong>${company?.name}</strong> as <strong>${role.replace('_', ' ')}</strong>.</p>
        <p>Sign in with your email <code>${staffUser.email}</code>.</p>`,
      ctaLabel: 'Sign In to Workspace',
      ctaUrl: `${env.CLIENT_URL}/login`,
    }),
  });

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'STAFF_INVITED',
    resourceType: 'CompanyMembership',
    resourceId: membership._id.toString(),
    description: `Invited ${staffUser.name} (${staffUser.email}) as ${role}`,
    ipAddress: req.ip,
  });

  const populated = await membership.populate('userId', 'name email phone role active createdAt');

  res.status(201).json({
    success: true,
    message: 'Team member invited successfully.',
    data: populated,
  });
}

export async function updateStaff(req: AuthRequest, res: Response): Promise<void> {
  if (!['company_owner', 'company_admin'].includes(req.user?.companyRole || '')) {
    throw new AppError('Only Company Owners or Admins can modify team permissions.', 403, 'FORBIDDEN');
  }

  const membership = await CompanyMembership.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });

  if (!membership) {
    throw new AppError('Team member not found.', 404, 'NOT_FOUND');
  }

  if (membership.role === 'company_owner') {
    throw new AppError('Cannot modify the Company Owner role.', 400, 'CANNOT_MODIFY_OWNER');
  }

  if (req.body.role) {
    membership.role = req.body.role;
    await User.updateOne({ _id: membership.userId }, { $set: { role: req.body.role } });
  }
  if (req.body.status) {
    membership.status = req.body.status;
  }
  if (req.body.permissions) {
    membership.permissions = req.body.permissions;
  }

  await membership.save();

  await logActivity({
    companyId: req.companyId,
    actorId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'PERMISSION_CHANGED',
    resourceType: 'CompanyMembership',
    resourceId: membership._id.toString(),
    description: `Updated staff membership (${membership.role}, status: ${membership.status})`,
    ipAddress: req.ip,
  });

  const populated = await membership.populate('userId', 'name email phone role active createdAt');

  res.json({
    success: true,
    message: 'Team member updated.',
    data: populated,
  });
}

export async function removeStaff(req: AuthRequest, res: Response): Promise<void> {
  if (req.user?.companyRole !== 'company_owner') {
    throw new AppError('Only the Company Owner can remove staff members.', 403, 'FORBIDDEN');
  }

  const membership = await CompanyMembership.findOne({
    _id: req.params.id,
    companyId: req.companyId,
  });

  if (!membership) {
    throw new AppError('Team member not found.', 404, 'NOT_FOUND');
  }

  if (membership.role === 'company_owner') {
    throw new AppError('Cannot remove the Company Owner.', 400, 'CANNOT_REMOVE_OWNER');
  }

  await membership.deleteOne();
  await User.updateOne({ _id: membership.userId }, { $set: { active: false } });

  res.json({
    success: true,
    message: 'Team member removed.',
  });
}
