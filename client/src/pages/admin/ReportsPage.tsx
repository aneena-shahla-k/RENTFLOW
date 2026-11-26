import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Category } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function ReportsPage() {
  const { company } = useAuth();
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const [tab, setTab] = useState<'revenue' | 'bookings' | 'inventory'>('revenue');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get('/categories')).data.data,
  });

  const { data: revData, isLoading: revLoading } = useQuery({
    queryKey: ['report-revenue', startDate, endDate],
    queryFn: async () => (await api.get('/reports/revenue', { params: { startDate, endDate } })).data.data,
  });

  const { data: bkData, isLoading: bkLoading } = useQuery({
    queryKey: ['report-bookings', startDate, endDate],
    queryFn: async () => (await api.get('/reports/bookings', { params: { startDate, endDate } })).data.data,
  });

  const { data: invData, isLoading: invLoading } = useQuery({
    queryKey: ['report-inventory', categoryId],
    queryFn: async () => (await api.get('/reports/inventory', { params: { categoryId } })).data.data,
  });

  const handleExport = async (type: 'csv' | 'pdf') => {
    try {
      const res = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'csv' ? 'rentflow-bookings-report.csv' : 'rentflow-business-report.pdf';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Export failed.'));
    }
  };

  return (
    <AdminLayout title="Reports & Analytics">
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Input label="From" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="w-40">
            <Input label="To" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          {tab === 'inventory' && (
            <div className="w-48">
              <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => handleExport('csv')}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => handleExport('pdf')}>
            Export PDF
          </Button>
          <Button variant="outline" size="sm" icon={<Printer className="h-3.5 w-3.5" />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 pb-3 print:hidden">
        {[
          { id: 'revenue', label: 'Revenue, Tax & Payments' },
          { id: 'bookings', label: 'Bookings, Overdue & Customers' },
          { id: 'inventory', label: 'Product Performance & Utilization' },
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

      {tab === 'revenue' && (
        revLoading ? <DashboardSkeleton /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card padding="sm"><p className="text-xs text-slate-500">Total Revenue</p><p className="text-lg font-bold mt-1">{formatMoney(revData.summary.totalRevenue, cur, sym)}</p></Card>
              <Card padding="sm"><p className="text-xs text-slate-500">Rental Subtotal</p><p className="text-lg font-bold mt-1">{formatMoney(revData.summary.rentalSubtotal, cur, sym)}</p></Card>
              <Card padding="sm"><p className="text-xs text-slate-500">GST / Tax Collected</p><p className="text-lg font-bold mt-1">{formatMoney(revData.summary.taxCollected, cur, sym)}</p></Card>
              <Card padding="sm"><p className="text-xs text-slate-500">Delivery Fees</p><p className="text-lg font-bold mt-1">{formatMoney(revData.summary.deliveryCollected, cur, sym)}</p></Card>
              <Card padding="sm"><p className="text-xs text-slate-500">Deposits Held</p><p className="text-lg font-bold mt-1">{formatMoney(revData.summary.depositsHeld, cur, sym)}</p></Card>
            </div>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Monthly Revenue & Tax Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revData.monthlySeries.map((m: { _id: string; revenue: number; tax: number }) => ({
                      month: m._id,
                      revenue: Math.round(m.revenue / 100),
                      tax: Math.round(m.tax / 100),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" name={`Revenue (${sym})`} fill="#4F46E5" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="tax" name={`Tax (${sym})`} fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Table>
              <THead>
                <tr>
                  <Th>Order ID</Th>
                  <Th>Booking</Th>
                  <Th>Customer</Th>
                  <Th>Gateway</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {revData.payments.map((p: {
                  _id: string;
                  orderId: string;
                  gateway: string;
                  amount: number;
                  status: string;
                  bookingId?: { bookingReference?: string };
                  customerId?: { name?: string };
                }) => (
                  <tr key={p._id}>
                    <Td className="font-mono text-xs">{p.orderId}</Td>
                    <Td className="font-semibold">{p.bookingId?.bookingReference}</Td>
                    <Td>{p.customerId?.name}</Td>
                    <Td><Badge tone="neutral">{p.gateway}</Badge></Td>
                    <Td className="font-semibold">{formatMoney(p.amount, cur, sym)}</Td>
                    <Td><Badge tone={getStatusBadgeTone(p.status === 'captured' ? 'paid' : p.status)}>{p.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )
      )}

      {tab === 'bookings' && (
        bkLoading ? <DashboardSkeleton /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Bookings by Status</h3>
                <div className="space-y-2">
                  {bkData.byStatus.map((s: { _id: string; count: number; totalValue: number }) => (
                    <div key={s._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                      <Badge tone={getStatusBadgeTone(s._id)}>{s._id.replace(/_/g, ' ')}</Badge>
                      <span className="font-semibold">{s.count} bookings · {formatMoney(s.totalValue, cur, sym)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Top Customers by Activity</h3>
                <div className="space-y-2">
                  {bkData.topCustomers.map((c: { customerName: string; customerEmail: string; bookings: number; totalSpent: number }) => (
                    <div key={c.customerEmail} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">{c.customerName}</p>
                        <p className="text-slate-500">{c.customerEmail}</p>
                      </div>
                      <span className="font-bold">{c.bookings} orders · {formatMoney(c.totalSpent, cur, sym)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-3">Overdue Rentals ({bkData.overdueBookings.length})</h3>
              {bkData.overdueBookings.length === 0 ? (
                <p className="text-xs text-slate-500">No overdue rentals right now.</p>
              ) : (
                <div className="space-y-2">
                  {bkData.overdueBookings.map((o: { _id: string; bookingReference: string; endDate: string; customerId?: { name?: string } }) => (
                    <div key={o._id} className="flex justify-between rounded-xl bg-rose-50 px-4 py-2.5 text-xs">
                      <span className="font-bold text-rose-900">{o.bookingReference} · {o.customerId?.name}</span>
                      <span className="text-rose-700">Due {formatDate(o.endDate)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )
      )}

      {tab === 'inventory' && (
        invLoading ? <DashboardSkeleton /> : (
          <Table>
            <THead>
              <tr>
                <Th>Product / SKU</Th>
                <Th>Category</Th>
                <Th>Stock (Avail / Total)</Th>
                <Th>Utilization</Th>
                <Th>Units Rented</Th>
                <Th>Generated Revenue</Th>
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {invData.performance.map((p: {
                _id: string;
                name: string;
                sku: string;
                category: string;
                availableStock: number;
                totalStock: number;
                utilizationPercent: number;
                totalUnitsRented: number;
                totalRevenue: number;
              }) => (
                <tr key={p._id}>
                  <Td>
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.sku}</p>
                  </Td>
                  <Td>{p.category}</Td>
                  <Td>{p.availableStock} / {p.totalStock}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-brand-600" style={{ width: `${p.utilizationPercent}%` }} />
                      </div>
                      <span className="text-xs font-semibold">{p.utilizationPercent}%</span>
                    </div>
                  </Td>
                  <Td className="font-semibold">{p.totalUnitsRented}</Td>
                  <Td className="font-semibold">{formatMoney(p.totalRevenue, cur, sym)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )
      )}
    </AdminLayout>
  );
}
