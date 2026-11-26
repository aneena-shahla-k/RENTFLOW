import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  Clock,
  DollarSign,
  Package,
  PackageCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

const CHART_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#64748B'];

export function AdminDashboardPage() {
  const { company } = useAuth();
  const [range, setRange] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-dashboard', range, customStart, customEnd],
    queryFn: async () => {
      const params: Record<string, string> = { range };
      if (range === 'custom' && customStart && customEnd) {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const res = await api.get('/dashboard/admin', { params });
      return res.data.data;
    },
  });

  return (
    <AdminLayout title="Workspace Overview">
      {/* Date Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last 30 days' },
            { id: 'this_month', label: 'This month' },
            { id: 'custom', label: 'Custom range' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRange(opt.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold border transition-colors ${
                range === opt.id
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {/* 8 Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Products', value: data.summary.totalProducts, icon: Package, tone: 'text-slate-700 bg-slate-100' },
              { label: 'Available Products', value: data.summary.availableProducts, icon: PackageCheck, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Currently Rented', value: `${data.summary.currentlyRented} units`, icon: TrendingUp, tone: 'text-brand-700 bg-brand-50' },
              { label: 'Active Bookings', value: data.summary.activeBookings, icon: CalendarCheck, tone: 'text-sky-700 bg-sky-50' },
              { label: 'Pending Bookings', value: data.summary.pendingBookings, icon: Clock, tone: 'text-amber-700 bg-amber-50' },
              { label: 'Overdue Returns', value: data.summary.overdueReturns, icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50' },
              { label: 'Filtered Revenue', value: formatMoney(data.summary.totalRevenue, cur, sym), icon: DollarSign, tone: 'text-emerald-700 bg-emerald-50' },
              { label: 'Monthly Revenue', value: formatMoney(data.summary.monthlyRevenue, cur, sym), icon: DollarSign, tone: 'text-brand-700 bg-brand-50' },
            ].map((kpi) => (
              <Card key={kpi.label} padding="sm" className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                  <p className="mt-1.5 text-xl font-extrabold text-slate-900">{kpi.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.tone}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </Card>
            ))}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Monthly Rental Revenue ({sym})</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="revenueMajor"
                      name={`Revenue (${sym})`}
                      stroke="#4F46E5"
                      fill="#EEF2FF"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Booking Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.bookingTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="bookings" name="Bookings" fill="#4F46E5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Product Category Distribution</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.categoryDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label
                    >
                      {data.charts.categoryDistribution.map((_: unknown, idx: number) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Most Rented Products</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.mostRentedProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="rentedQty" name="Units Rented" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Booking Status Distribution</h3>
              <div className="space-y-2.5">
                {data.charts.bookingStatusDistribution.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No bookings in selected range.</p>
                ) : (
                  data.charts.bookingStatusDistribution.map((row: { status: string; count: number }) => (
                    <div key={row.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <Badge tone={getStatusBadgeTone(row.status)}>{row.status.replace(/_/g, ' ')}</Badge>
                      <span className="font-bold text-slate-900">{row.count}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Operational Lists */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Recent Bookings</h3>
                <Link to="/admin/bookings" className="text-xs font-semibold text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {data.recentBookings.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No bookings yet.</p>
                ) : (
                  data.recentBookings.map((b: {
                    _id: string;
                    bookingReference: string;
                    status: string;
                    startDate: string;
                    endDate: string;
                    customerId?: { name?: string };
                    pricing: { totalAmount: number };
                  }) => (
                    <Link
                      key={b._id}
                      to={`/admin/bookings/${b._id}`}
                      className="flex items-center justify-between py-3 hover:bg-slate-50 px-2 rounded-xl transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {b.bookingReference} · {b.customerId?.name || 'Customer'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDate(b.startDate)} → {formatDate(b.endDate)}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge tone={getStatusBadgeTone(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
                        <p className="text-xs font-semibold text-slate-900">
                          {formatMoney(b.pricing.totalAmount, cur, sym)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-900">Upcoming Returns & Low Stock</h3>
                <Link to="/admin/returns" className="text-xs font-semibold text-brand-600 hover:underline">
                  Manage returns
                </Link>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Due for Return
                  </p>
                  {data.upcomingReturns.length === 0 ? (
                    <p className="text-xs text-slate-500">No active rentals due soon.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.upcomingReturns.map((r: {
                        _id: string;
                        bookingReference: string;
                        endDate: string;
                        customerId?: { name?: string };
                      }) => (
                        <div key={r._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-800">
                            {r.bookingReference} · {r.customerId?.name}
                          </span>
                          <span className="text-slate-600">Due {formatDate(r.endDate)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Low-Stock Alerts
                  </p>
                  {data.lowStockAlerts.length === 0 ? (
                    <p className="text-xs text-slate-500">All active products are well stocked.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.lowStockAlerts.map((p: {
                        _id: string;
                        name: string;
                        sku: string;
                        availableStock: number;
                        totalStock: number;
                      }) => (
                        <div key={p._id} className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/70 px-3 py-2 text-xs">
                          <span className="font-semibold text-amber-950">
                            {p.name} ({p.sku})
                          </span>
                          <Badge tone="warning">
                            {p.availableStock}/{p.totalStock} left
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Activity Log */}
          <Card>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Workspace Activities</h3>
            {data.recentActivities.length === 0 ? (
              <p className="text-xs text-slate-500">No recent activities logged.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentActivities.map((act: {
                  _id: string;
                  actorName: string;
                  action: string;
                  description: string;
                  createdAt: string;
                }) => (
                  <div key={act._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{act.actorName}</span>{' '}
                      <span className="text-slate-600">— {act.description}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">{formatDateTime(act.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}
