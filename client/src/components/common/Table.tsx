import React from 'react';
import { cn } from '../../utils/cn';

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-soft', className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </thead>
  );
}

export function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-4 py-3.5 whitespace-nowrap', className)}>{children}</th>;
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3.5 text-slate-700 align-middle', className)}>{children}</td>;
}
