import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, Upload, UserPlus, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { resolveImageUrl } from '../../utils/format';

const STEPS = [
  'Company Details',
  'Business Category',
  'Business Address',
  'Currency & Tax',
  'Rental Policies',
  'Company Logo',
  'Invite Staff',
  'Complete Setup',
];

export function OnboardingWizardPage() {
  const { company, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
    description: '',
    businessType: 'Cameras & Photography Equipment',
    street: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    currency: 'INR',
    currencySymbol: '₹',
    taxEnabled: true,
    taxRate: 18,
    taxInclusive: false,
    gstNumber: '',
    deliveryEnabled: true,
    defaultDeliveryFeeMajor: 250,
    lateFeePerDayPercent: 25,
    securityDepositRequired: true,
    minRentalDays: 1,
    maxRentalDays: 90,
    bookingHoldMinutes: 15,
    termsAndConditions: '',
  });

  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [staffInvite, setStaffInvite] = useState({
    name: '',
    email: '',
    role: 'rental_staff' as 'company_admin' | 'rental_staff',
  });
  const [invitedList, setInvitedList] = useState<Array<{ name: string; email: string; role: string }>>([]);

  useEffect(() => {
    if (!company) return;
    setStep(company.onboardingStep || 1);
    setLogoPreview(company.logoUrl || '');
    setForm({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      website: company.website || '',
      description: company.description || '',
      businessType: company.businessType || 'Cameras & Photography Equipment',
      street: company.address?.street || '',
      city: company.address?.city || '',
      state: company.address?.state || '',
      country: company.address?.country || 'India',
      postalCode: company.address?.postalCode || '',
      currency: company.settings?.currency || 'INR',
      currencySymbol: company.settings?.currencySymbol || '₹',
      taxEnabled: company.settings?.taxEnabled ?? true,
      taxRate: company.settings?.taxRate ?? 18,
      taxInclusive: company.settings?.taxInclusive ?? false,
      gstNumber: company.settings?.gstNumber || '',
      deliveryEnabled: company.settings?.deliveryEnabled ?? true,
      defaultDeliveryFeeMajor: Math.round((company.settings?.defaultDeliveryFee || 0) / 100),
      lateFeePerDayPercent: company.settings?.lateFeePerDayPercent ?? 25,
      securityDepositRequired: company.settings?.securityDepositRequired ?? true,
      minRentalDays: company.settings?.minRentalDays ?? 1,
      maxRentalDays: company.settings?.maxRentalDays ?? 90,
      bookingHoldMinutes: company.settings?.bookingHoldMinutes ?? 15,
      termsAndConditions: company.settings?.termsAndConditions || '',
    });
  }, [company]);

  const persistStep = async (nextStep: number, markComplete = false) => {
    setSaving(true);
    try {
      await api.patch('/companies/me', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        website: form.website,
        description: form.description,
        businessType: form.businessType,
        onboardingStep: nextStep,
        onboardingCompleted: markComplete,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          country: form.country,
          postalCode: form.postalCode,
        },
        settings: {
          currency: form.currency,
          currencySymbol: form.currencySymbol,
          taxEnabled: form.taxEnabled,
          taxRate: Number(form.taxRate),
          taxInclusive: form.taxInclusive,
          gstNumber: form.gstNumber,
          deliveryEnabled: form.deliveryEnabled,
          defaultDeliveryFee: Math.round(Number(form.defaultDeliveryFeeMajor) * 100),
          lateFeePerDayPercent: Number(form.lateFeePerDayPercent),
          securityDepositRequired: form.securityDepositRequired,
          minRentalDays: Number(form.minRentalDays),
          maxRentalDays: Number(form.maxRentalDays),
          bookingHoldMinutes: Number(form.bookingHoldMinutes),
          termsAndConditions: form.termsAndConditions,
        },
      });
      await refreshSession();
      if (markComplete) {
        toast.success('Workspace setup completed!');
        navigate('/admin', { replace: true });
      } else {
        setStep(nextStep);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save progress.'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append('logo', file);
    setUploadingLogo(true);
    try {
      const res = await api.post('/companies/me/logo', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoPreview(res.data.data.logoUrl);
      toast.success('Company logo uploaded!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Logo upload failed.'));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!staffInvite.name || !staffInvite.email) {
      toast.error('Enter staff name and email.');
      return;
    }
    try {
      await api.post('/staff', staffInvite);
      setInvitedList((prev) => [...prev, staffInvite]);
      setStaffInvite({ name: '', email: '', role: 'rental_staff' });
      toast.success('Staff member invited!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to invite staff.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <Badge tone="brand">
            Step {step} of {STEPS.length} · {STEPS[step - 1]}
          </Badge>
        </div>

        {/* Stepper Bar */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {STEPS.map((label, idx) => {
            const num = idx + 1;
            const done = num < step;
            const active = num === step;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setStep(num)}
                className={`rounded-xl px-2 py-2 text-center text-[11px] font-semibold border transition-all ${
                  active
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : done
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {done ? '✓ ' : `${num}. `}
                <span className="hidden sm:inline">{label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <Card padding="lg">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Company Details</h2>
              <p className="text-sm text-slate-600">Confirm your business contact details shown on invoices and customer notifications.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Company Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input label="Business Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Input label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input label="Website (optional)" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
              </div>
              <Textarea label="Business Summary" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your rental catalog and service area..." />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Business Category</h2>
              <p className="text-sm text-slate-600">Select the primary rental category for your workspace.</p>
              <Select label="Primary Category" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
                <option value="Cameras & Photography Equipment">Cameras & Photography Equipment</option>
                <option value="Laptops & Electronics">Laptops & Electronics</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Construction Equipment">Construction Equipment</option>
                <option value="Event Equipment">Event Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Tools & Machinery">Tools & Machinery</option>
                <option value="Other Rentable Products">Other Rentable Products</option>
              </Select>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Business Address</h2>
              <Input label="Street Address" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input label="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <Input label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                <Input label="Postal Code" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Currency & Tax Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Currency"
                  value={form.currency}
                  onChange={(e) => {
                    const code = e.target.value;
                    const sym = code === 'USD' ? '$' : code === 'EUR' ? '€' : '₹';
                    setForm({ ...form, currency: code, currencySymbol: sym });
                  }}
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </Select>
                <Input
                  label="Tax / GST Rate (%)"
                  type="number"
                  value={form.taxRate}
                  onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
                />
                <Input
                  label="GST / Tax ID"
                  value={form.gstNumber}
                  onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                  placeholder="29ABCDE1234F1Z5"
                />
              </div>
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.taxEnabled}
                    onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })}
                  />
                  Enable tax calculation on bookings
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.taxInclusive}
                    onChange={(e) => setForm({ ...form, taxInclusive: e.target.checked })}
                  />
                  Prices are tax-inclusive
                </label>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Rental Policies</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label="Min Rental Days"
                  type="number"
                  min={1}
                  value={form.minRentalDays}
                  onChange={(e) => setForm({ ...form, minRentalDays: Number(e.target.value) })}
                />
                <Input
                  label="Max Rental Days"
                  type="number"
                  min={1}
                  value={form.maxRentalDays}
                  onChange={(e) => setForm({ ...form, maxRentalDays: Number(e.target.value) })}
                />
                <Input
                  label="Late Fee / Day (% of daily rate)"
                  type="number"
                  min={0}
                  value={form.lateFeePerDayPercent}
                  onChange={(e) => setForm({ ...form, lateFeePerDayPercent: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={`Default Delivery Charge (${form.currencySymbol})`}
                  type="number"
                  min={0}
                  value={form.defaultDeliveryFeeMajor}
                  onChange={(e) => setForm({ ...form, defaultDeliveryFeeMajor: Number(e.target.value) })}
                />
                <Input
                  label="Checkout Hold Expiry (Minutes)"
                  type="number"
                  min={5}
                  max={120}
                  value={form.bookingHoldMinutes}
                  onChange={(e) => setForm({ ...form, bookingHoldMinutes: Number(e.target.value) })}
                />
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.deliveryEnabled}
                    onChange={(e) => setForm({ ...form, deliveryEnabled: e.target.checked })}
                  />
                  Offer delivery (uncheck for pickup-only)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.securityDepositRequired}
                    onChange={(e) => setForm({ ...form, securityDepositRequired: e.target.checked })}
                  />
                  Collect refundable security deposits
                </label>
              </div>
              <Textarea
                label="Rental Terms & Conditions"
                rows={3}
                value={form.termsAndConditions}
                onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
              />
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Upload Company Logo</h2>
              <p className="text-sm text-slate-600">Your logo appears on customer invoices and storefront cards.</p>
              <div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                <div className="h-24 w-24 rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={resolveImageUrl(logoPreview)} alt="Company logo" className="h-full w-full object-contain" />
                  ) : (
                    <Upload className="h-8 w-8 text-slate-300" />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                    <Upload className="h-4 w-4" />
                    {uploadingLogo ? 'Uploading...' : 'Select Logo Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  <p className="text-xs text-slate-500">PNG, JPG or WebP up to 5 MB.</p>
                </div>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Invite Staff (Optional)</h2>
              <p className="text-sm text-slate-600">Add administrators or warehouse staff to help manage bookings and returns.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Staff Name"
                  value={staffInvite.name}
                  onChange={(e) => setStaffInvite({ ...staffInvite, name: e.target.value })}
                  placeholder="Karan Mehta"
                />
                <Input
                  label="Email"
                  type="email"
                  value={staffInvite.email}
                  onChange={(e) => setStaffInvite({ ...staffInvite, email: e.target.value })}
                  placeholder="karan@company.com"
                />
                <Select
                  label="Role"
                  value={staffInvite.role}
                  onChange={(e) => setStaffInvite({ ...staffInvite, role: e.target.value as 'company_admin' | 'rental_staff' })}
                >
                  <option value="rental_staff">Rental Staff</option>
                  <option value="company_admin">Company Admin</option>
                </Select>
              </div>
              <Button type="button" variant="outline" icon={<UserPlus className="h-4 w-4" />} onClick={handleInviteStaff}>
                Send Invitation
              </Button>
              {invitedList.length > 0 && (
                <div className="space-y-2 pt-2">
                  {invitedList.map((m) => (
                    <div key={m.email} className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-xs">
                      <span className="font-semibold text-emerald-900">{m.name} ({m.email})</span>
                      <Badge tone="success">{m.role.replace('_', ' ')}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Ready to Launch {form.name}!</h2>
              <p className="mx-auto max-w-md text-sm text-slate-600">
                Your rental policies, tax configuration ({form.taxEnabled ? `${form.taxRate}%` : 'Disabled'}), and workspace details are saved.
              </p>
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-mono text-slate-700">
                Workspace Code: <strong>{company?.companyCode}</strong>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
            <Button
              variant="outline"
              disabled={step === 1 || saving}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              icon={<ArrowLeft className="h-4 w-4" />}
            >
              Previous
            </Button>

            {step < 8 ? (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/admin')}
                >
                  Skip for now
                </Button>
                <Button
                  loading={saving}
                  onClick={() => persistStep(step + 1)}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Save & Continue
                </Button>
              </div>
            ) : (
              <Button
                loading={saving}
                onClick={() => persistStep(8, true)}
                icon={<Check className="h-4 w-4" />}
              >
                Complete Setup & Enter Dashboard
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
