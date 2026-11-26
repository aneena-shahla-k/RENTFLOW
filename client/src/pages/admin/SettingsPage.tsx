import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { formatDateTime, formatMoney } from '../../utils/format';

export function SettingsPage() {
  const { company, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'workspace' | 'staff' | 'subscription' | 'logs'>('workspace');

  const [settingsForm, setSettingsForm] = useState({
    name: '',
    email: '',
    phone: '',
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
    termsAndConditions: '',
  });

  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'rental_staff' as 'company_admin' | 'rental_staff',
  });

  useEffect(() => {
    if (!company) return;
    setSettingsForm({
      name: company.name,
      email: company.email,
      phone: company.phone,
      taxEnabled: company.settings.taxEnabled,
      taxRate: company.settings.taxRate,
      taxInclusive: company.settings.taxInclusive,
      gstNumber: company.settings.gstNumber || '',
      deliveryEnabled: company.settings.deliveryEnabled,
      defaultDeliveryFeeMajor: Math.round((company.settings.defaultDeliveryFee || 0) / 100),
      lateFeePerDayPercent: company.settings.lateFeePerDayPercent,
      securityDepositRequired: company.settings.securityDepositRequired,
      minRentalDays: company.settings.minRentalDays,
      maxRentalDays: company.settings.maxRentalDays,
      termsAndConditions: company.settings.termsAndConditions || '',
    });
  }, [company]);

  const { data: staff = [] } = useQuery({
    queryKey: ['company-staff'],
    queryFn: async () => (await api.get('/staff')).data.data,
  });

  const { data: subData } = useQuery({
    queryKey: ['company-subscription'],
    queryFn: async () => (await api.get('/subscriptions')).data.data,
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['company-activity-logs'],
    queryFn: async () => (await api.get('/activity-logs')).data.data,
  });

  const saveSettings = useMutation({
    mutationFn: () =>
      api.patch('/companies/me', {
        name: settingsForm.name,
        email: settingsForm.email,
        phone: settingsForm.phone,
        settings: {
          taxEnabled: settingsForm.taxEnabled,
          taxRate: Number(settingsForm.taxRate),
          taxInclusive: settingsForm.taxInclusive,
          gstNumber: settingsForm.gstNumber,
          deliveryEnabled: settingsForm.deliveryEnabled,
          defaultDeliveryFee: Math.round(Number(settingsForm.defaultDeliveryFeeMajor) * 100),
          lateFeePerDayPercent: Number(settingsForm.lateFeePerDayPercent),
          securityDepositRequired: settingsForm.securityDepositRequired,
          minRentalDays: Number(settingsForm.minRentalDays),
          maxRentalDays: Number(settingsForm.maxRentalDays),
          termsAndConditions: settingsForm.termsAndConditions,
        },
      }),
    onSuccess: async () => {
      await refreshSession();
      toast.success('Workspace settings saved!');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/staff', inviteForm),
    onSuccess: () => {
      toast.success('Staff member invited!');
      setInviteForm({ name: '', email: '', phone: '', role: 'rental_staff' });
      queryClient.invalidateQueries({ queryKey: ['company-staff'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const changePlanMutation = useMutation({
    mutationFn: (plan: string) => api.post('/subscriptions/change-plan', { plan, billingCycle: 'monthly' }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['company-subscription'] });
      refreshSession();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <AdminLayout title="Workspace Settings, Team & Billing">
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'workspace', label: 'Workspace & Tax Rules' },
          { id: 'staff', label: 'Team & Permissions' },
          { id: 'subscription', label: 'Subscription & Usage' },
          { id: 'logs', label: 'Activity Logs' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'workspace' && (
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings.mutate();
            }}
            className="space-y-4 max-w-3xl"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Company Name" value={settingsForm.name} onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })} />
              <Input label="Email" value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} />
              <Input label="Phone" value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Tax / GST Rate (%)" type="number" value={settingsForm.taxRate} onChange={(e) => setSettingsForm({ ...settingsForm, taxRate: Number(e.target.value) })} />
              <Input label="GSTIN" value={settingsForm.gstNumber} onChange={(e) => setSettingsForm({ ...settingsForm, gstNumber: e.target.value })} />
              <Input label="Default Delivery Fee" type="number" value={settingsForm.defaultDeliveryFeeMajor} onChange={(e) => setSettingsForm({ ...settingsForm, defaultDeliveryFeeMajor: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Min Rental Days" type="number" min={1} value={settingsForm.minRentalDays} onChange={(e) => setSettingsForm({ ...settingsForm, minRentalDays: Number(e.target.value) })} />
              <Input label="Max Rental Days" type="number" min={1} value={settingsForm.maxRentalDays} onChange={(e) => setSettingsForm({ ...settingsForm, maxRentalDays: Number(e.target.value) })} />
              <Input label="Late Fee / Day (%)" type="number" min={0} value={settingsForm.lateFeePerDayPercent} onChange={(e) => setSettingsForm({ ...settingsForm, lateFeePerDayPercent: Number(e.target.value) })} />
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={settingsForm.taxEnabled} onChange={(e) => setSettingsForm({ ...settingsForm, taxEnabled: e.target.checked })} />
                Enable Tax / GST
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={settingsForm.taxInclusive} onChange={(e) => setSettingsForm({ ...settingsForm, taxInclusive: e.target.checked })} />
                Tax Inclusive Pricing
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={settingsForm.deliveryEnabled} onChange={(e) => setSettingsForm({ ...settingsForm, deliveryEnabled: e.target.checked })} />
                Enable Delivery Option
              </label>
              <label className="flex items-center gap-2 text-xs font-medium">
                <input type="checkbox" checked={settingsForm.securityDepositRequired} onChange={(e) => setSettingsForm({ ...settingsForm, securityDepositRequired: e.target.checked })} />
                Require Security Deposits
              </label>
            </div>
            <Textarea label="Rental Terms & Conditions" rows={3} value={settingsForm.termsAndConditions} onChange={(e) => setSettingsForm({ ...settingsForm, termsAndConditions: e.target.value })} />
            <Button type="submit" loading={saveSettings.isPending}>Save Settings</Button>
          </form>
        </Card>
      )}

      {tab === 'staff' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Invite Team Member</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                inviteMutation.mutate();
              }}
              className="space-y-3"
            >
              <Input label="Full Name" required value={inviteForm.name} onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })} />
              <Input label="Email" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
              <Input label="Phone" value={inviteForm.phone} onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })} />
              <Select label="Role" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'company_admin' | 'rental_staff' })}>
                <option value="rental_staff">Rental Staff</option>
                <option value="company_admin">Company Admin</option>
              </Select>
              <Button type="submit" className="w-full" loading={inviteMutation.isPending} icon={<UserPlus className="h-4 w-4" />}>
                Invite Member
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Workspace Team ({staff.length})</h3>
            <div className="divide-y divide-slate-100">
              {staff.map((m: {
                _id: string;
                role: string;
                status: string;
                userId?: { name?: string; email?: string };
              }) => (
                <div key={m._id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{m.userId?.name}</p>
                    <p className="text-slate-500">{m.userId?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="brand">{m.role.replace('_', ' ')}</Badge>
                    <Badge tone={getStatusBadgeTone(m.status)}>{m.status}</Badge>
                    {m.role !== 'company_owner' && (
                      <button
                        type="button"
                        onClick={async () => {
                          await api.delete(`/staff/${m._id}`);
                          queryClient.invalidateQueries({ queryKey: ['company-staff'] });
                          toast.success('Member removed.');
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'subscription' && subData && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{subData.notice}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="sm">
              <p className="text-xs text-slate-500">Products Used</p>
              <p className="text-xl font-bold mt-1">{subData.usage.productsUsed} / {subData.usage.maxProducts}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-slate-500">Team Members</p>
              <p className="text-xl font-bold mt-1">{subData.usage.staffUsed} / {subData.usage.maxStaff}</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs text-slate-500">Monthly Bookings</p>
              <p className="text-xl font-bold mt-1">{subData.usage.monthlyBookingsUsed} / {subData.usage.maxBookingsPerMonth}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {subData.availablePlans.map((plan: {
              id: string;
              name: string;
              tagline: string;
              monthlyPriceInSmallestUnit: number;
              features: string[];
            }) => {
              const isCurrent = subData.subscription.plan === plan.id;
              return (
                <Card key={plan.id} className={isCurrent ? 'border-brand-500 ring-2 ring-brand-500/20' : ''}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
                    {isCurrent && <Badge tone="brand">Current Plan</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-4">
                    {formatMoney(plan.monthlyPriceInSmallestUnit)}
                    <span className="text-xs font-normal text-slate-500"> / mo</span>
                  </p>
                  <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-brand-600" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-5"
                    variant={isCurrent ? 'outline' : 'primary'}
                    disabled={isCurrent || changePlanMutation.isPending}
                    onClick={() => changePlanMutation.mutate(plan.id)}
                  >
                    {isCurrent ? 'Active Plan' : `Switch to ${plan.name}`}
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <Card>
          <h3 className="text-sm font-bold text-slate-900 mb-4">Audit & Activity Logs</h3>
          <div className="divide-y divide-slate-100">
            {logs.map((log: {
              _id: string;
              actorName: string;
              actorRole: string;
              action: string;
              description: string;
              createdAt: string;
            }) => (
              <div key={log._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                <div>
                  <Badge tone="neutral" className="mr-2">{log.action}</Badge>
                  <span className="font-semibold text-slate-900">{log.actorName}</span>{' '}
                  <span className="text-slate-600">— {log.description}</span>
                </div>
                <span className="text-[11px] text-slate-400">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}
