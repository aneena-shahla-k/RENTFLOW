import React from 'react';
import { ErrorState } from './ErrorState';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full">
            <ErrorState
              title="Something went wrong in this view"
              message={this.state.message || 'Please reload the page to continue.'}
              onRetry={() => window.location.reload()}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
