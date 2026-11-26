import { Layers } from 'lucide-react';
import { cn } from '../../utils/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
  showTagline?: boolean;
}

export function Logo({ size = 'md', light = false, showTagline = false }: LogoProps) {
  const iconSize = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 text-white shadow-soft',
          iconSize
        )}
      >
        <Layers className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span
          className={cn(
            'font-bold tracking-tight leading-none',
            textSize,
            light ? 'text-white' : 'text-slate-900'
          )}
        >
          Rent<span className={light ? 'text-brand-300' : 'text-brand-600'}>Flow</span>
        </span>
        {showTagline && (
          <span className={cn('text-[11px] mt-0.5', light ? 'text-slate-400' : 'text-slate-500')}>
            Rent smarter. Manage better.
          </span>
        )}
      </div>
    </div>
  );
}
