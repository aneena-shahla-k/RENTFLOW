import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarCheck, CreditCard, ShoppingBag, Store } from 'lucide-react';
import { CustomerLayout } from './CustomerLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { useCart } from '../../store/cartContext';
import { Booking } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function CustomerOverviewPage() {
  const { user } = useAuth();
  const { items: cartItems } = useCart();

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['customer-bookings-overview'],
    queryFn: async () => (await api.get('/bookings', { params: { limit: 10 } })).data.data,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['customer-invoices-overview'],
    queryFn: async () => (await api.get('/invoices')).data.data,
  });

  const bookings: Booking[] = bookingsData?.items || [];
  const activeCount = bookings.filter((b) =>
    ['confirmed', 'paid', 'ready_for_pickup', 'out_for_delivery', 'active_rental'].includes(b.status)
  ).length;
  const pendingPaymentCount = bookings.filter(
    (b) => b.paymentStatus !== 'paid' && !['cancelled', 'rejected'].includes(b.status)
  ).length;

  return (
    <CustomerLayout title={`Welcome, ${user?.name || 'Customer'}`}>
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Bookings</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{bookings.length}</p>
              </div>
              <CalendarCheck className="h-6 w-6 text-brand-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Active Rentals</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{activeCount}</p>
              </div>
              <Store className="h-6 w-6 text-emerald-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Awaiting Payment</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{pendingPaymentCount}</p>
              </div>
              <CreditCard className="h-6 w-6 text-amber-600" />
            </Card>
            <Card padding="sm" className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Items in Cart</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{cartItems.length}</p>
              </div>
              <ShoppingBag className="h-6 w-6 text-sky-600" />
            </Card>
          </div>

          <Card className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-brand-900 text-white border-0">
            <div>
              <h2 className="text-lg font-bold">Need equipment for an upcoming project?</h2>
              <p className="text-xs text-slate-300 mt-1">
                Browse verified rental providers, check real-time date availability, and book in minutes.
              </p>
            </div>
            <Link to="/customer/catalog">
              <Button icon={<ArrowRight className="h-4 w-4" />}>Browse Equipment</Button>
            </Link>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent Bookings</h3>
              <Link to="/customer/bookings" className="text-xs font-semibold text-brand-600 hover:underline">
                View all ({bookings.length})
              </Link>
            </div>
            {bookings.length === 0 ? (
              <EmptyState
                title="No bookings yet. Your bookings will appear here."
                description="Explore our catalog to check equipment availability and reserve your dates."
                actionLabel="Browse Products"
                onAction={() => (window.location.href = '/customer/catalog')}
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.slice(0, 5).map((b) => (
                  <Link
                    key={b._id}
                    to={`/customer/bookings/${b._id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-slate-900">{b.bookingReference}</p>
                      <p className="text-xs text-slate-500">
                        {formatDate(b.startDate)} → {formatDate(b.endDate)} ({b.rentalDays} days)
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={getStatusBadgeTone(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs font-bold text-slate-900">
                        {formatMoney(b.pricing.totalAmount)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {invoices.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Recent Invoices</h3>
                <Link to="/customer/payments" className="text-xs font-semibold text-brand-600 hover:underline">
                  All invoices
                </Link>
              </div>
              <div className="space-y-2">
                {invoices.slice(0, 3).map((inv: { _id: string; invoiceNumber: string; totalAmount: number; issuedAt: string }) => (
                  <div key={inv._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</span>
                    <span className="text-slate-500">{formatDate(inv.issuedAt)}</span>
                    <span className="font-semibold">{formatMoney(inv.totalAmount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </CustomerLayout>
  );
}
