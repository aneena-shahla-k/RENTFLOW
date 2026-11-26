import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Response } from 'express';
import { env } from '../config/env.js';
import { Company } from '../models/Company.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { logActivity } from '../services/activity.service.js';
import { renderRentFlowEmailTemplate, sendEmail } from '../services/email.service.js';
import { AuthRequest, SUBSCRIPTION_PLANS } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import {
  generateRandomToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function slugifyCompany(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  const suffix = crypto.randomBytes(2).toString('hex');
  return `${base || 'company'}-${suffix}`;
}

function generateCompanyCode(): string {
  return `RF-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function issueSessionTokens(
  user: InstanceType<typeof User>,
  companyId?: string,
  userAgent?: string
) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId,
  });

  const { token: refreshToken } = signRefreshToken(user._id.toString());
  const refreshHash = hashToken(refreshToken);

  const validTokens = (user.refreshTokens || [])
    .filter((entry) => entry.expiresAt > new Date())
    .slice(-4);

  validTokens.push({
    tokenHash: refreshHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    userAgent,
    createdAt: new Date(),
  });

  user.refreshTokens = validTokens;
  user.lastLoginAt = new Date();
  await user.save();

  return { accessToken, refreshToken };
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const body = req.body;
  const existing = await User.findOne({ email: body.email });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const rawVerifyToken = generateRandomToken(24);
  const verifyTokenHash = hashToken(rawVerifyToken);

  if (body.accountType === 'company') {
    const user = await User.create({
      name: body.ownerName,
      email: body.email,
      phone: body.phone,
      passwordHash,
      role: 'company_owner',
      isEmailVerified: false,
      emailVerificationTokenHash: verifyTokenHash,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const company = await Company.create({
      name: body.companyName,
      slug: slugifyCompany(body.companyName),
      companyCode: generateCompanyCode(),
      businessType: body.businessType,
      email: body.email,
      phone: body.phone,
      address: body.businessAddress,
      ownerId: user._id,
      status: 'approved',
      onboardingCompleted: false,
      onboardingStep: 1,
    });

    await CompanyMembership.create({
      userId: user._id,
      companyId: company._id,
      role: 'company_owner',
      status: 'active',
      permissions: ['*'],
    });

    const starter = SUBSCRIPTION_PLANS.starter;
    await Subscription.create({
      companyId: company._id,
      plan: 'starter',
      status: 'trialing',
      mode: 'dev_simulated',
      billingCycle: 'monthly',
      priceInSmallestUnit: starter.monthlyPriceInSmallestUnit,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    const { accessToken, refreshToken } = await issueSessionTokens(
      user,
      company._id.toString(),
      req.headers['user-agent']
    );
    setRefreshCookie(res, refreshToken);

    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawVerifyToken}`;
    await sendEmail({
      to: user.email,
      subject: `Welcome to RentFlow — Verify your ${company.name} workspace`,
      html: renderRentFlowEmailTemplate({
        title: `Welcome to RentFlow, ${user.name}!`,
        bodyHtml: `<p>Your rental workspace <strong>${company.name}</strong> (${company.companyCode}) has been created.</p>
          <p>Please verify your email address to secure your account and complete your workspace onboarding.</p>`,
        ctaLabel: 'Verify Email Address',
        ctaUrl: verifyUrl,
      }),
    });

    await logActivity({
      companyId: company._id,
      actorId: user._id,
      actorName: user.name,
      actorRole: user.role,
      action: 'COMPANY_REGISTERED',
      resourceType: 'Company',
      resourceId: company._id.toString(),
      description: `Registered rental business "${company.name}" (${company.companyCode})`,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Company workspace created successfully.',
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        },
        company,
        redirectTo: '/admin/onboarding',
      },
    });
    return;
  }

  // Customer registration
  const customer = await User.create({
    name: body.name,
    email: body.email,
    phone: body.phone,
    passwordHash,
    role: 'customer',
    isEmailVerified: false,
    emailVerificationTokenHash: verifyTokenHash,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const { accessToken, refreshToken } = await issueSessionTokens(
    customer,
    undefined,
    req.headers['user-agent']
  );
  setRefreshCookie(res, refreshToken);

  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawVerifyToken}`;
  await sendEmail({
    to: customer.email,
    subject: 'Welcome to RentFlow — Verify your email',
    html: renderRentFlowEmailTemplate({
      title: `Welcome to RentFlow, ${customer.name}!`,
      bodyHtml: '<p>Your customer account is ready. Browse equipment, check live date availability, and book seamlessly.</p>',
      ctaLabel: 'Verify Email Address',
      ctaUrl: verifyUrl,
    }),
  });

  await logActivity({
    actorId: customer._id,
    actorName: customer.name,
    actorRole: customer.role,
    action: 'CUSTOMER_REGISTERED',
    resourceType: 'User',
    resourceId: customer._id.toString(),
    description: `Customer account registered for ${customer.email}`,
    ipAddress: req.ip,
  });

  res.status(201).json({
    success: true,
    message: 'Customer account created successfully.',
    data: {
      accessToken,
      refreshToken,
      user: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        role: customer.role,
        isEmailVerified: customer.isEmailVerified,
      },
      redirectTo: '/customer',
    },
  });
}

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokens');

  if (!user) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }
  if (!user.active) {
    throw new AppError('Your account has been deactivated.', 403, 'ACCOUNT_DISABLED');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  let company = null;
  let companyId: string | undefined;
  let companyRole: string | undefined;

  if (['company_owner', 'company_admin', 'rental_staff'].includes(user.role)) {
    const membership = await CompanyMembership.findOne({
      userId: user._id,
      status: 'active',
    });
    if (!membership) {
      throw new AppError('Your company membership is inactive or suspended.', 403, 'MEMBERSHIP_INACTIVE');
    }
    company = await Company.findById(membership.companyId);
    if (!company) {
      throw new AppError('Associated company workspace not found.', 404, 'COMPANY_NOT_FOUND');
    }
    companyId = company._id.toString();
    companyRole = membership.role;
  }

  const { accessToken, refreshToken } = await issueSessionTokens(
    user,
    companyId,
    req.headers['user-agent']
  );
  setRefreshCookie(res, refreshToken);

  await logActivity({
    companyId,
    actorId: user._id,
    actorName: user.name,
    actorRole: user.role,
    action: 'USER_LOGIN',
    resourceType: 'User',
    resourceId: user._id.toString(),
    description: `${user.name} signed in`,
    ipAddress: req.ip,
  });

  res.json({
    success: true,
    message: 'Signed in successfully.',
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        companyId,
        companyRole,
      },
      company,
    },
  });
}

export async function refresh(req: AuthRequest, res: Response): Promise<void> {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!rawToken) {
    throw new AppError('Refresh token required.', 401, 'NO_REFRESH_TOKEN');
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashToken(rawToken);
  const user = await User.findById(payload.sub).select('+refreshTokens');
  if (!user || !user.active) {
    throw new AppError('Account not found or inactive.', 401, 'UNAUTHORIZED');
  }

  const matched = user.refreshTokens.find(
    (entry) => entry.tokenHash === tokenHash && entry.expiresAt > new Date()
  );
  if (!matched) {
    throw new AppError('Refresh session revoked or expired.', 401, 'SESSION_REVOKED');
  }

  // Rotate refresh token
  user.refreshTokens = user.refreshTokens.filter((entry) => entry.tokenHash !== tokenHash);

  let companyId: string | undefined;
  if (['company_owner', 'company_admin', 'rental_staff'].includes(user.role)) {
    const membership = await CompanyMembership.findOne({ userId: user._id, status: 'active' });
    companyId = membership?.companyId.toString();
  }

  const { accessToken, refreshToken: newRefreshToken } = await issueSessionTokens(
    user,
    companyId,
    req.headers['user-agent']
  );
  setRefreshCookie(res, newRefreshToken);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
}

export async function logout(req: AuthRequest, res: Response): Promise<void> {
  const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;

  if (rawToken && req.user) {
    const tokenHash = hashToken(rawToken);
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { refreshTokens: { tokenHash } } }
    );
  }

  if (req.user) {
    await logActivity({
      companyId: req.user.companyId,
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: 'USER_LOGOUT',
      resourceType: 'User',
      resourceId: req.user.id,
      description: `${req.user.name} signed out`,
      ipAddress: req.ip,
    });
  }

  res.clearCookie('refreshToken', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
}

export async function forgotPassword(req: AuthRequest, res: Response): Promise<void> {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    const rawToken = generateRandomToken(24);
    user.resetPasswordTokenHash = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
    await sendEmail({
      to: user.email,
      subject: 'RentFlow — Reset your password',
      html: renderRentFlowEmailTemplate({
        title: 'Reset your RentFlow password',
        bodyHtml:
          '<p>We received a request to reset your password. This link is valid for 1 hour.</p>',
        ctaLabel: 'Reset Password',
        ctaUrl: resetUrl,
      }),
    });
  }

  res.json({
    success: true,
    message: 'If an account matches that email, password reset instructions have been sent.',
  });
}

export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  const { token, password } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    resetPasswordTokenHash: tokenHash,
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordTokenHash +resetPasswordExpires +refreshTokens');

  if (!user) {
    throw new AppError('Invalid or expired password reset token.', 400, 'INVALID_RESET_TOKEN');
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  user.resetPasswordTokenHash = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  res.json({ success: true, message: 'Password has been reset successfully. Please sign in.' });
}

export async function verifyEmail(req: AuthRequest, res: Response): Promise<void> {
  const { token } = req.body;
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user) {
    throw new AppError('Invalid or expired verification token.', 400, 'INVALID_VERIFY_TOKEN');
  }

  user.isEmailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  res.json({ success: true, message: 'Email verified successfully.' });
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const user = await User.findById(req.user._id).select('-passwordHash -refreshTokens');
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }

  let company = null;
  let subscription = null;

  if (req.user.companyId) {
    company = await Company.findById(req.user.companyId);
    subscription = await Subscription.findOne({ companyId: req.user.companyId });
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        companyId: req.user.companyId,
        companyRole: req.user.companyRole,
      },
      company,
      subscription,
    },
  });
}

export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).select('-passwordHash -refreshTokens');

  res.json({
    success: true,
    message: 'Profile updated successfully.',
    data: updated,
  });
}
