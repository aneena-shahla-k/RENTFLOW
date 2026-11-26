import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Star } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Select, Textarea } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { Booking } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function CustomerBookingsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewTarget, setReviewTarget] = useState<{ bookingId: string; productId: string; productName: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-bookings', statusFilter],
    queryFn: async () =>
      (await api.get('/bookings', { params: { status: statusFilter, limit: 30 } })).data.data,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      api.post('/reviews', {
        bookingId: reviewTarget!.bookingId,
        productId: reviewTarget!.productId,
        rating,
        comment,
      }),
    onSuccess: () => {
      toast.success('Verified rental review submitted!');
      setReviewTarget(null);
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['customer-bookings'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const bookings: Booking[] = data?.items || [];

  return (
    <CustomerLayout title="My Bookings & Rental History">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="w-52">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Bookings</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="paid">Paid</option>
            <option value="active_rental">Active Rental</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <Link to="/customer/catalog">
          <Button size="sm">New Booking</Button>
        </Link>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet. Your bookings will appear here."
          description="Browse equipment from verified rental providers to place your first reservation."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Reference</Th>
              <Th>Provider & Items</Th>
              <Th>Dates</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {bookings.map((b) => {
              const comp = typeof b.companyId === 'string' ? null : b.companyId;
              const firstItem = b.items?.[0];
              const canReview = ['returned', 'completed'].includes(b.status) && firstItem;
              return (
                <tr key={b._id}>
                  <Td className="font-mono font-bold text-slate-900">{b.bookingReference}</Td>
                  <Td>
                    <p className="font-semibold text-slate-900">{comp?.name || 'Provider'}</p>
                    <p className="text-xs text-slate-500">
                      {firstItem ? `${firstItem.productName}${b.items && b.items.length > 1 ? ` +${b.items.length - 1} more` : ''}` : 'Equipment'}
                    </p>
                  </Td>
                  <Td className="text-xs">
                    {formatDate(b.startDate)} → {formatDate(b.endDate)}
                  </Td>
                  <Td className="font-semibold">{formatMoney(b.pricing.totalAmount)}</Td>
                  <Td>
                    <Badge tone={getStatusBadgeTone(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      {canReview && firstItem && (
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Star className="h-3.5 w-3.5 text-amber-500" />}
                          onClick={() =>
                            setReviewTarget({
                              bookingId: b._id,
                              productId:
                                typeof firstItem.productId === 'string'
                                  ? firstItem.productId
                                  : firstItem.productId._id,
                              productName: firstItem.productName,
                            })
                          }
                        >
                          Review
                        </Button>
                      )}
                      <Link to={`/customer/bookings/${b._id}`}>
                        <Button size="sm" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />}>
                          View
                        </Button>
                      </Link>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={`Review ${reviewTarget?.productName || ''}`}
        description="Your review will carry a Verified Rental badge."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reviewMutation.mutate();
          }}
          className="space-y-4"
        >
          <Select label="Rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            <option value={5}>5 Stars — Excellent</option>
            <option value={4}>4 Stars — Good</option>
            <option value={3}>3 Stars — Average</option>
            <option value={2}>2 Stars — Fair</option>
            <option value={1}>1 Star — Poor</option>
          </Select>
          <Textarea
            label="Your Experience"
            required
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share equipment condition, pickup speed, and performance..."
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReviewTarget(null)}>Cancel</Button>
            <Button type="submit" loading={reviewMutation.isPending}>Submit Verified Review</Button>
          </div>
        </form>
      </Modal>
    </CustomerLayout>
  );
}
