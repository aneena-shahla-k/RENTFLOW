import React from 'react';
import { cn } from '../../utils/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function getStatusBadgeTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'approved':
    case 'paid':
    case 'completed':
    case 'returned':
    case 'delivered':
    case 'collected':
    case 'resolved':
      return 'success';
    case 'confirmed':
    case 'active_rental':
    case 'out_for_delivery':
    case 'ready_for_pickup':
    case 'dispatched':
    case 'in_progress':
    case 'professional':
      return 'brand';
    case 'pending':
    case 'payment_pending':
    case 'hold':
    case 'preparing':
    case 'pickup_scheduled':
    case 'return_requested':
    case 'maintenance':
    case 'trialing':
    case 'waiting_for_customer':
      return 'warning';
    case 'overdue':
    case 'rejected':
    case 'cancelled':
    case 'suspended':
    case 'failed':
    case 'past_due':
      return 'danger';
    case 'open':
    case 'business':
      return 'info';
    default:
      return 'neutral';
  }
}
