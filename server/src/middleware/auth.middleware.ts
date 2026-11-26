import { NextFunction, Response } from 'express';
import { Company } from '../models/Company.js';
import { CompanyMembership } from '../models/CompanyMembership.js';
import { User } from '../models/User.js';
import { AuthRequest, UserRole } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/jwt.js';

function extractAccessToken(req: AuthRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.accessToken) {
    return String(req.cookies.accessToken);
  }
  return null;
}

export async function requireAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractAccessToken(req);
    if (!token) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new AppError('Invalid or expired access token.', 401, 'TOKEN_EXPIRED');
    }

    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokens');
    if (!user || !user.active) {
      throw new AppError('Account not found or inactive.', 401, 'UNAUTHORIZED');
    }

    req.user = {
      _id: user._id,
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    // Attach active membership context if user is a company role
    if (['company_owner', 'company_admin', 'rental_staff'].includes(user.role)) {
      const membership = await CompanyMembership.findOne({
        userId: user._id,
        status: 'active',
      });
      if (membership) {
        req.user.companyId = membership.companyId;
        req.user.companyRole = membership.role;
        req.companyId = membership.companyId;
        req.companyMembership = {
          _id: membership._id,
          role: membership.role,
          permissions: membership.permissions,
        };
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractAccessToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash -refreshTokens');
    if (user && user.active) {
      req.user = {
        _id: user._id,
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      };
      if (['company_owner', 'company_admin', 'rental_staff'].includes(user.role)) {
        const membership = await CompanyMembership.findOne({
          userId: user._id,
          status: 'active',
        });
        if (membership) {
          req.companyId = membership.companyId;
          req.user.companyId = membership.companyId;
          req.user.companyRole = membership.role;
        }
      }
    }
  } catch {
    // Ignore invalid optional token
  }
  next();
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
}

/**
 * Strictly derives tenant identity from the authenticated user's active CompanyMembership.
 * Never trusts companyId supplied from req.body, req.query, or req.params.
 */
export function requireCompanyContext(options?: { allowSuspended?: boolean }) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
      }

      if (!['company_owner', 'company_admin', 'rental_staff'].includes(req.user.role)) {
        throw new AppError('Company workspace access required.', 403, 'FORBIDDEN');
      }

      const membership = await CompanyMembership.findOne({
        userId: req.user._id,
        status: 'active',
      });

      if (!membership) {
        throw new AppError('No active company membership found for your account.', 403, 'NO_TENANT_CONTEXT');
      }

      const company = await Company.findById(membership.companyId);
      if (!company) {
        throw new AppError('Company workspace not found.', 404, 'COMPANY_NOT_FOUND');
      }

      if (!options?.allowSuspended && company.status === 'suspended') {
        throw new AppError(
          'Your company workspace is currently suspended. Contact platform support.',
          403,
          'COMPANY_SUSPENDED'
        );
      }

      req.companyId = company._id;
      req.user.companyId = company._id;
      req.user.companyRole = membership.role;
      req.companyMembership = {
        _id: membership._id,
        role: membership.role,
        permissions: membership.permissions,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
