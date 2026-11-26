import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function Card({ className, padding = 'md', hover = false, children, ...props }: CardProps) {
  const padClass =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-4'
        : padding === 'lg'
          ? 'p-6 sm:p-8'
          : 'p-5 sm:p-6';

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-slate-200/80 shadow-soft',
        hover && 'transition-all duration-200 hover:shadow-card hover:border-slate-300/80',
        padClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
