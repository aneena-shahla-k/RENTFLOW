import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { getHomePathForRole } from '../../routes/ProtectedRoute';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setSessionData } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login', values);
      const { accessToken, user, company } = res.data.data;
      setSessionData({ accessToken, user, company });
      toast.success(`Welcome back, ${user.name}!`);

      if (
        ['company_owner', 'company_admin', 'rental_staff'].includes(user.role) &&
        company &&
        !company.onboardingCompleted &&
        user.role === 'company_owner'
      ) {
        navigate('/admin/onboarding', { replace: true });
      } else {
        navigate(getHomePathForRole(user.role), { replace: true });
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Invalid credentials.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Sign in to your account</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Manage your rental workspace or track your customer bookings.
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              leftIcon={<Lock className="h-4 w-4" />}
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-end">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={submitting}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            New to RentFlow?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
