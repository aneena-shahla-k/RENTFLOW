import { Types } from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'signature',
  'razorpay_signature',
  'secret',
  'cardNumber',
  'cvv',
]);

function scrubSensitive(obj?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    result[key] = value;
  }
  return result;
}

export async function logActivity(params: {
  companyId?: Types.ObjectId | string;
  actorId?: Types.ObjectId | string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await ActivityLog.create({
      companyId: params.companyId,
      actorId: params.actorId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      description: params.description,
      metadata: scrubSensitive(params.metadata),
      ipAddress: params.ipAddress,
    });
  } catch (err) {
    console.error('[ActivityService] Failed to record activity log:', (err as Error).message);
  }
}
