import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Input, Select } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Booking } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function AdminBookingsPage() {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-bookings', page, search, statusFilter],
    queryFn: async () => {
      const res = await api.get('/bookings', {
        params: { page, limit: 12, search, status: statusFilter },
      });
      return res.data.data as {
        items: Booking[];
        pagination: { page: number; total: number; totalPages: number };
      };
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/bookings/${id}/status`, { status }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const bookings = data?.items || [];

  return (
    <AdminLayout title="Booking Management">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search booking reference..."
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-52">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="paid">Paid</option>
            <option value="ready_for_pickup">Ready for Pickup</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="active_rental">Active Rental</option>
            <option value="return_requested">Return Requested</option>
            <option value="returned">Returned</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet. Your bookings will appear here."
          description="When customers submit rental reservations, you can review, approve, dispatch, and track returns from here."
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>Reference</Th>
                <Th>Customer</Th>
                <Th>Dates</Th>
                <Th>Items</Th>
                <Th>Total</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => {
                const customer = typeof b.customerId === 'string' ? null : b.customerId;
                return (
                  <tr key={b._id} className="hover:bg-slate-50/70">
                    <Td className="font-mono font-bold text-slate-900">{b.bookingReference}</Td>
                    <Td>
                      <p className="font-semibold text-slate-900">{customer?.name || 'Customer'}</p>
                      <p className="text-xs text-slate-500">{customer?.email}</p>
                    </Td>
                    <Td>
                      <p className="text-xs font-medium text-slate-800">
                        {formatDate(b.startDate)} → {formatDate(b.endDate)}
                      </p>
                      <p className="text-[11px] text-slate-500">{b.rentalDays} day(s) · {b.fulfillmentType}</p>
                    </Td>
                    <Td className="text-xs">{b.items?.length || 0} item(s)</Td>
                    <Td className="font-semibold">{formatMoney(b.pricing.totalAmount, cur, sym)}</Td>
                    <Td>
                      <Badge tone={getStatusBadgeTone(b.paymentStatus)}>{b.paymentStatus}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={getStatusBadgeTone(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {b.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              title="Approve"
                              onClick={() => statusMutation.mutate({ id: b._id, status: 'confirmed' })}
                              icon={<Check className="h-3.5 w-3.5 text-emerald-600" />}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              title="Reject"
                              onClick={() => statusMutation.mutate({ id: b._id, status: 'rejected' })}
                              icon={<X className="h-3.5 w-3.5 text-rose-600" />}
                            />
                          </>
                        )}
                        <Link to={`/admin/bookings/${b._id}`}>
                          <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />}>
                            Details
                          </Button>
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {data?.pagination.page} of {data?.pagination.totalPages} ({data?.pagination.total} bookings)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= (data?.pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
