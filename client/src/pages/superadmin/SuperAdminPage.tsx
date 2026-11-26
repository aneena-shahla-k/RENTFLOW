import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, DollarSign, ShieldAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout, NavItem } from '../../layouts/DashboardLayout';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { api, getApiErrorMessage } from '../../services/api';
import { formatDateTime, formatMoney } from '../../utils/format';

const SUPER_NAV: NavItem[] = [
  { label: 'Platform Overview', to: '/superadmin', icon: Building2, end: true },
];

export function SuperAdminPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'companies' | 'plans' | 'support' | 'logs'>('companies');

  const { data: overview, isLoading } = useQuery({
    queryKey: ['superadmin-overview'],
    queryFn: async () => (await api.get('/superadmin/overview')).data.data,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['superadmin-companies'],
    queryFn: async () => (await api.get('/superadmin/companies')).data.data,
  });

  const { data: supportTickets = [] } = useQuery({
    queryKey: ['superadmin-support'],
    queryFn: async () => (await api.get('/superadmin/support')).data.data,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/superadmin/companies/${id}/status`, { status }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const subMutation = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      api.patch(`/superadmin/companies/${id}/subscription`, { plan }),
    onSuccess: () => {
      toast.success('Subscription plan updated.');
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] });
    },
  });

  return (
    <DashboardLayout title="Platform Super Admin" navItems={SUPER_NAV}>
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          {/* Platform KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Registered Companies</p>
                <p className="text-2xl font-extrabold mt-1">{overview.stats.totalCompanies}</p>
              </div>
              <Building2 className="h-6 w-6 text-brand-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Users</p>
                <p className="text-2xl font-extrabold mt-1">{overview.stats.totalUsers}</p>
              </div>
              <Users className="h-6 w-6 text-sky-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Suspended Workspaces</p>
                <p className="text-2xl font-extrabold mt-1">{overview.stats.suspendedCompanies}</p>
              </div>
              <ShieldAlert className="h-6 w-6 text-rose-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Platform Verified GMV</p>
                <p className="text-2xl font-extrabold mt-1">{formatMoney(overview.stats.platformGmv)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-emerald-600" />
            </Card>
          </div>

          {/* Section Switcher */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            {[
              { id: 'companies', label: 'Registered Companies' },
              { id: 'plans', label: 'Pricing Plans' },
              { id: 'support', label: `Support Tickets (${supportTickets.length})` },
              { id: 'logs', label: 'Platform Activity Logs' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as typeof tab)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                  tab === t.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'companies' && (
            <Table>
              <THead>
                <tr>
                  <Th>Company</Th>
                  <Th>Owner</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c: {
                  _id: string;
                  name: string;
                  companyCode: string;
                  businessType: string;
                  status: string;
                  ownerId?: { name?: string; email?: string };
                  subscription?: { plan?: string; status?: string };
                }) => (
                  <tr key={c._id}>
                    <Td>
                      <p className="font-bold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.companyCode} · {c.businessType}</p>
                    </Td>
                    <Td className="text-xs">
                      <p className="font-semibold">{c.ownerId?.name}</p>
                      <p className="text-slate-500">{c.ownerId?.email}</p>
                    </Td>
                    <Td>
                      <select
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        value={c.subscription?.plan || 'starter'}
                        onChange={(e) => subMutation.mutate({ id: c._id, plan: e.target.value })}
                      >
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="business">Business</option>
                      </select>
                    </Td>
                    <Td>
                      <Badge tone={getStatusBadgeTone(c.status)}>{c.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        {c.status !== 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => statusMutation.mutate({ id: c._id, status: 'approved' })}
                          >
                            Approve
                          </Button>
                        )}
                        {c.status !== 'suspended' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => statusMutation.mutate({ id: c._id, status: 'suspended' })}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          {tab === 'plans' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {overview.plans.map((p: {
                id: string;
                name: string;
                monthlyPriceInSmallestUnit: number;
                limits: { maxProducts: number; maxStaff: number; maxBookingsPerMonth: number };
              }) => (
                <Card key={p.id}>
                  <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                  <p className="text-2xl font-extrabold mt-2">{formatMoney(p.monthlyPriceInSmallestUnit)}/mo</p>
                  <div className="mt-4 space-y-1 text-xs text-slate-600">
                    <p>Max Products: <strong>{p.limits.maxProducts}</strong></p>
                    <p>Max Staff: <strong>{p.limits.maxStaff}</strong></p>
                    <p>Monthly Bookings: <strong>{p.limits.maxBookingsPerMonth}</strong></p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'support' && (
            <Card>
              <div className="divide-y divide-slate-100">
                {supportTickets.map((t: {
                  _id: string;
                  ticketNumber: string;
                  subject: string;
                  status: string;
                  customerId?: { name?: string };
                  companyId?: { name?: string };
                }) => (
                  <div key={t._id} className="flex items-center justify-between py-3 text-xs">
                    <div>
                      <span className="font-mono font-bold text-brand-600 mr-2">{t.ticketNumber}</span>
                      <span className="font-semibold text-slate-900">{t.subject}</span>
                      <p className="text-slate-500">Customer: {t.customerId?.name} · Company: {t.companyId?.name || 'Platform'}</p>
                    </div>
                    <Badge tone={getStatusBadgeTone(t.status)}>{t.status.replace(/_/g, ' ')}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === 'logs' && (
            <Card>
              <div className="divide-y divide-slate-100">
                {overview.recentLogs.map((l: { _id: string; actorName: string; action: string; description: string; createdAt: string }) => (
                  <div key={l._id} className="flex items-center justify-between py-2.5 text-xs">
                    <div>
                      <Badge tone="neutral" className="mr-2">{l.action}</Badge>
                      <span className="font-semibold">{l.actorName}</span> — {l.description}
                    </div>
                    <span className="text-slate-400">{formatDateTime(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
