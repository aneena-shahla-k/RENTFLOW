import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Building2, User as UserIcon } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Input, Select } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';

const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Include 1 uppercase letter')
  .regex(/[a-z]/, 'Include 1 lowercase letter')
  .regex(/[0-9]/, 'Include 1 number');

const customerSchema = z
  .object({
    name: z.string().min(2, 'Full name is required'),
    email: z.string().email('Valid email required'),
    phone: z.string().min(7, 'Valid phone number required'),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const companySchema = z
  .object({
    ownerName: z.string().min(2, 'Owner name is required'),
    companyName: z.string().min(2, 'Company name is required'),
    email: z.string().email('Valid business email required'),
    phone: z.string().min(7, 'Valid phone number required'),
    businessType: z.string().min(2, 'Select a business category'),
    street: z.string().min(2, 'Street address is required'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    country: z.string().min(2, 'Country is required'),
    postalCode: z.string().min(3, 'Postal code is required'),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type CustomerForm = z.infer<typeof customerSchema>;
type CompanyForm = z.infer<typeof companySchema>;

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'company' ? 'company' : 'customer';
  const [mode, setMode] = useState<'customer' | 'company'>(initialType);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { setSessionData } = useAuth();

  const customerForm = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      businessType: 'Cameras & Photography Equipment',
      country: 'India',
    },
  });

  const onCustomerSubmit = async (values: CustomerForm) => {
    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', {
        accountType: 'customer',
        ...values,
      });
      const { accessToken, user } = res.data.data;
      setSessionData({ accessToken, user, company: null });
      toast.success('Customer account created!');
      navigate('/customer', { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Registration failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onCompanySubmit = async (values: CompanyForm) => {
    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', {
        accountType: 'company',
        ownerName: values.ownerName,
        companyName: values.companyName,
        email: values.email,
        phone: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
        businessType: values.businessType,
        businessAddress: {
          street: values.street,
          city: values.city,
          state: values.state,
          country: values.country,
          postalCode: values.postalCode,
        },
      });
      const { accessToken, user, company } = res.data.data;
      setSessionData({ accessToken, user, company });
      toast.success(`Workspace "${company.name}" created!`);
      navigate('/admin/onboarding', { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Company registration failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">Create your RentFlow account</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Choose whether you are registering a rental business or booking equipment as a customer.
          </p>
        </div>

        {/* Account Type Switcher */}
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-200/60 p-1.5">
          <button
            type="button"
            onClick={() => setMode('customer')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              mode === 'customer'
                ? 'bg-white text-slate-900 shadow-soft'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="h-4 w-4" /> Customer Account
          </button>
          <button
            type="button"
            onClick={() => setMode('company')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              mode === 'company'
                ? 'bg-white text-slate-900 shadow-soft'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" /> Rental Business
          </button>
        </div>

        <Card>
          {mode === 'customer' ? (
            <form onSubmit={customerForm.handleSubmit(onCustomerSubmit)} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="Priya Nair"
                error={customerForm.formState.errors.name?.message}
                {...customerForm.register('name')}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="priya@example.com"
                  error={customerForm.formState.errors.email?.message}
                  {...customerForm.register('email')}
                />
                <Input
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  error={customerForm.formState.errors.phone?.message}
                  {...customerForm.register('phone')}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 chars, A-Z, 0-9"
                  error={customerForm.formState.errors.password?.message}
                  {...customerForm.register('password')}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  error={customerForm.formState.errors.confirmPassword?.message}
                  {...customerForm.register('confirmPassword')}
                />
              </div>
              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                Create Customer Account
              </Button>
            </form>
          ) : (
            <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Owner Name"
                  placeholder="Rohan Verma"
                  error={companyForm.formState.errors.ownerName?.message}
                  {...companyForm.register('ownerName')}
                />
                <Input
                  label="Company Name"
                  placeholder="Apex Lens Rentals"
                  error={companyForm.formState.errors.companyName?.message}
                  {...companyForm.register('companyName')}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Business Email"
                  type="email"
                  placeholder="ops@apexrentals.com"
                  error={companyForm.formState.errors.email?.message}
                  {...companyForm.register('email')}
                />
                <Input
                  label="Phone Number"
                  placeholder="+91 98765 43210"
                  error={companyForm.formState.errors.phone?.message}
                  {...companyForm.register('phone')}
                />
              </div>
              <Select
                label="Business Category"
                error={companyForm.formState.errors.businessType?.message}
                {...companyForm.register('businessType')}
              >
                <option value="Cameras & Photography Equipment">Cameras & Photography Equipment</option>
                <option value="Laptops & Electronics">Laptops & Electronics</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Construction Equipment">Construction Equipment</option>
                <option value="Event Equipment">Event Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Tools & Machinery">Tools & Machinery</option>
                <option value="Other Rentable Products">Other Rentable Products</option>
              </Select>

              <Input
                label="Business Street Address"
                placeholder="42 Indiranagar 100ft Road"
                error={companyForm.formState.errors.street?.message}
                {...companyForm.register('street')}
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Input
                  label="City"
                  placeholder="Bengaluru"
                  error={companyForm.formState.errors.city?.message}
                  {...companyForm.register('city')}
                />
                <Input
                  label="State"
                  placeholder="Karnataka"
                  error={companyForm.formState.errors.state?.message}
                  {...companyForm.register('state')}
                />
                <Input
                  label="Country"
                  placeholder="India"
                  error={companyForm.formState.errors.country?.message}
                  {...companyForm.register('country')}
                />
                <Input
                  label="Postal Code"
                  placeholder="560038"
                  error={companyForm.formState.errors.postalCode?.message}
                  {...companyForm.register('postalCode')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Password"
                  type="password"
                  placeholder="Min 8 chars, A-Z, 0-9"
                  error={companyForm.formState.errors.password?.message}
                  {...companyForm.register('password')}
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="Repeat password"
                  error={companyForm.formState.errors.confirmPassword?.message}
                  {...companyForm.register('confirmPassword')}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                Create Business Workspace
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-600">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in here
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
