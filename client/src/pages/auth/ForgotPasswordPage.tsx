import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api, getApiErrorMessage } from '../../services/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('If an account exists for that email, reset instructions were dispatched.');
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Reset your password</h1>
        </div>
        <Card>
          {sent ? (
            <div className="text-center space-y-4 py-2">
              <p className="text-sm text-slate-600">
                Check your inbox (or server dev email log) for your password reset link.
              </p>
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">Back to Login</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Account Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              <Button type="submit" className="w-full" loading={loading}>
                Send Reset Link
              </Button>
              <div className="text-center text-xs">
                <Link to="/login" className="font-semibold text-brand-600">Back to Sign In</Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
