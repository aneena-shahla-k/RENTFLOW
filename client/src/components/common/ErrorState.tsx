import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load data',
  message = 'An error occurred while communicating with the server.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/40 px-6 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-slate-600">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
