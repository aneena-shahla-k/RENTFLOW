import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Logo } from '../../components/common/Logo';
import { api } from '../../services/api';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.message || 'Verification link is invalid or expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-md space-y-6 text-center">
        <Logo size="lg" />
        <Card className="space-y-4 py-8">
          {status === 'loading' && <p className="text-sm text-slate-600">{message}</p>}
          {status === 'success' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">{message}</h2>
              <Link to="/login" className="inline-block">
                <Button>Continue to Login</Button>
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-rose-600 mx-auto" />
              <h2 className="text-lg font-bold text-slate-900">Verification Failed</h2>
              <p className="text-sm text-slate-600">{message}</p>
              <Link to="/login" className="inline-block">
                <Button variant="outline">Back to Login</Button>
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
