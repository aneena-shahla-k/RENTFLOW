import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Download, Clock, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '../admin/AdminLayout';
import { CustomerLayout } from '../customer/CustomerLayout';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';
import { PaymentModal } from '../../components/payments/PaymentModal';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

export function BookingDetailPage({ mode }: { mode: 'admin' | 'customer' }) {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [extDate, setExtDate] = useState('');
  const [extReason, setExtReason] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['booking-detail', id],
    queryFn: async () => (await api.get(`/bookings/${id}`)).data.data,
  });

  const statusMutation = useMutation({
    mutationFn: () => api.patch(`/bookings/${id}/status`, { status: nextStatus, note: statusNote }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setStatusNote('');
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/bookings/${id}/cancel`, { reason: 'Cancelled by user' }),
    onSuccess: () => {
      toast.success('Booking cancelled.');
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const extensionMutation = useMutation({
    mutationFn: (payload: { action: 'request' | 'approve' | 'reject'; requestedEndDate?: string; reason?: string }) =>
      api.post(`/bookings/${id}/extension`, payload),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setExtDate('');
      setExtReason('');
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const downloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download PDF.'));
    }
  };

  const Wrapper = mode === 'admin' ? AdminLayout : CustomerLayout;

  if (isLoading) {
    return (
      <Wrapper title="Booking Details">
        <DashboardSkeleton />
      </Wrapper>
    );
  }

  if (isError || !data?.booking) {
    return (
      <Wrapper title="Booking Details">
        <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      </Wrapper>
    );
  }

  const { booking, items, payment, invoice, rentalReturn, delivery } = data;
  const company = booking.companyId;
  const customer = booking.customerId;
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const canPay =
    booking.paymentStatus !== 'paid' &&
    !['cancelled', 'rejected'].includes(booking.status) &&
    user?.role === 'customer';

  const canCancel = ['hold', 'pending', 'confirmed', 'payment_pending', 'paid'].includes(booking.status);

  return (
    <Wrapper title={`Booking ${booking.bookingReference}`}>
      <div className="space-y-6">
        {/* Top Summary Header */}
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-lg font-extrabold text-slate-900">
                {booking.bookingReference}
              </span>
              <Badge tone={getStatusBadgeTone(booking.status)}>{booking.status.replace(/_/g, ' ')}</Badge>
              <Badge tone={getStatusBadgeTone(booking.paymentStatus)}>
                Payment: {booking.paymentStatus}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              {formatDate(booking.startDate)} → {formatDate(booking.endDate)} ({booking.rentalDays} day(s)) · {booking.fulfillmentType.toUpperCase()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canPay && (
              <Button icon={<CreditCard className="h-4 w-4" />} onClick={() => setPayOpen(true)}>
                Pay {formatMoney(booking.pricing.totalAmount, cur, sym)}
              </Button>
            )}
            {invoice && (
              <Button
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() => downloadPdf(invoice._id, invoice.invoiceNumber)}
              >
                Invoice PDF
              </Button>
            )}
            {mode === 'customer' && booking.status === 'active_rental' && (
              <Button
                variant="outline"
                onClick={() => {
                  api.patch(`/bookings/${id}/status`).catch(() => {});
                  toast.info('Contact support or visit the store to initiate return inspection.');
                }}
              >
                Return Info
              </Button>
            )}
            {canCancel && (
              <Button
                variant="danger"
                size="sm"
                loading={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
              >
                Cancel Booking
              </Button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Booked Items */}
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Booked Equipment</h3>
              <div className="divide-y divide-slate-100">
                {items.map((item: {
                  _id: string;
                  productName: string;
                  productSku: string;
                  quantity: number;
                  unitDailyPrice: number;
                  lineSubtotal: number;
                }) => (
                  <div key={item._id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-xs text-slate-500">
                        SKU: {item.productSku} · Qty: {item.quantity} × {formatMoney(item.unitDailyPrice, cur, sym)}/day
                      </p>
                    </div>
                    <span className="font-bold text-slate-900">
                      {formatMoney(item.lineSubtotal, cur, sym)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Admin Status Controls */}
            {mode === 'admin' && (
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-3">Update Booking Status</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select value={nextStatus || booking.status} onChange={(e) => setNextStatus(e.target.value)}>
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
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                  <Input
                    placeholder="Optional audit note..."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                  <Button
                    loading={statusMutation.isPending}
                    onClick={() => statusMutation.mutate()}
                    disabled={!nextStatus || nextStatus === booking.status}
                  >
                    Apply Status
                  </Button>
                </div>
              </Card>
            )}

            {/* Extension Section */}
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-brand-600" /> Rental Extension
              </h3>
              {booking.extensionRequested?.status ? (
                <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Requested End Date: {formatDate(booking.extensionRequested.requestedEndDate)}
                    </span>
                    <Badge tone={getStatusBadgeTone(booking.extensionRequested.status)}>
                      {booking.extensionRequested.status}
                    </Badge>
                  </div>
                  {booking.extensionRequested.reason && (
                    <p className="text-slate-600">Reason: {booking.extensionRequested.reason}</p>
                  )}
                  {mode === 'admin' && booking.extensionRequested.status === 'pending' && (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={() => extensionMutation.mutate({ action: 'approve' })}>
                        Approve Extension
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => extensionMutation.mutate({ action: 'reject' })}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ) : mode === 'customer' && ['active_rental', 'paid', 'confirmed'].includes(booking.status) ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-44">
                    <Input
                      label="New Return Date"
                      type="date"
                      value={extDate}
                      onChange={(e) => setExtDate(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <Input
                      label="Reason"
                      placeholder="Need 2 extra shoot days"
                      value={extReason}
                      onChange={(e) => setExtReason(e.target.value)}
                    />
                  </div>
                  <Button
                    size="md"
                    disabled={!extDate}
                    loading={extensionMutation.isPending}
                    onClick={() =>
                      extensionMutation.mutate({
                        action: 'request',
                        requestedEndDate: extDate,
                        reason: extReason,
                      })
                    }
                  >
                    Request Extension
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No extension requests for this booking.</p>
              )}
            </Card>

            {/* Activity Timeline */}
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-brand-600" /> Booking Activity Timeline
              </h3>
              <div className="space-y-3 border-l-2 border-slate-200 pl-4">
                {booking.statusHistory.map((ev: {
                  status: string;
                  note?: string;
                  changedByName?: string;
                  changedAt: string;
                }, idx: number) => (
                  <div key={idx} className="text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone={getStatusBadgeTone(ev.status)}>{ev.status.replace(/_/g, ' ')}</Badge>
                      <span className="text-slate-400">{formatDateTime(ev.changedAt)}</span>
                    </div>
                    <p className="mt-1 text-slate-700">
                      {ev.note} {ev.changedByName ? `— by ${ev.changedByName}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Sidebar: Price Breakdown, Customer/Company, Payment & Return */}
          <div className="space-y-6">
            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-4">Price Breakdown</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Rental Subtotal</span>
                  <span className="font-semibold">{formatMoney(booking.pricing.rentalSubtotal, cur, sym)}</span>
                </div>
                {booking.pricing.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span>-{formatMoney(booking.pricing.discountAmount, cur, sym)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    GST / Tax ({booking.pricing.taxRate}% {booking.pricing.taxInclusive ? 'incl.' : 'excl.'})
                  </span>
                  <span className="font-semibold">{formatMoney(booking.pricing.taxAmount, cur, sym)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery Charge</span>
                  <span className="font-semibold">{formatMoney(booking.pricing.deliveryFee, cur, sym)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Security Deposit</span>
                  <span className="font-semibold">{formatMoney(booking.pricing.securityDeposit, cur, sym)}</span>
                </div>
                {booking.pricing.lateFeeAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Late Fee</span>
                    <span>{formatMoney(booking.pricing.lateFeeAmount, cur, sym)}</span>
                  </div>
                )}
                {booking.pricing.damageFeeAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Damage Fee</span>
                    <span>{formatMoney(booking.pricing.damageFeeAmount, cur, sym)}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2.5 flex justify-between text-sm font-extrabold text-slate-900">
                  <span>Total Amount</span>
                  <span>{formatMoney(booking.pricing.totalAmount, cur, sym)}</span>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                {mode === 'admin' ? 'Customer Details' : 'Rental Provider'}
              </h3>
              {mode === 'admin' ? (
                <div className="text-xs space-y-1 text-slate-600">
                  <p className="font-bold text-slate-900">{customer?.name}</p>
                  <p>{customer?.email}</p>
                  <p>{customer?.phone || '—'}</p>
                </div>
              ) : (
                <div className="text-xs space-y-1 text-slate-600">
                  <p className="font-bold text-slate-900">{company?.name}</p>
                  <p>{company?.email}</p>
                  <p>{company?.phone}</p>
                </div>
              )}
              {booking.deliveryAddress && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Delivery Address</p>
                  <p>
                    {booking.deliveryAddress.street}, {booking.deliveryAddress.city},{' '}
                    {booking.deliveryAddress.state} {booking.deliveryAddress.postalCode}
                  </p>
                </div>
              )}
            </Card>

            {payment && (
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Payment Details</h3>
                <div className="text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Gateway</span>
                    <Badge tone="neutral">{payment.gateway}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Order ID</span>
                    <span className="font-mono">{payment.orderId}</span>
                  </div>
                  {payment.paymentId && (
                    <div className="flex justify-between">
                      <span>Payment Ref</span>
                      <span className="font-mono">{payment.paymentId}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {delivery && (
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Fulfillment Status</h3>
                <div className="text-xs space-y-1.5">
                  <Badge tone={getStatusBadgeTone(delivery.status)}>{delivery.status.replace(/_/g, ' ')}</Badge>
                  {delivery.assignedStaffId && (
                    <p className="text-slate-600">Assigned: {delivery.assignedStaffId.name}</p>
                  )}
                </div>
              </Card>
            )}

            {rentalReturn && (
              <Card>
                <h3 className="text-sm font-bold text-slate-900 mb-2">Return Inspection</h3>
                <div className="text-xs space-y-1 text-slate-600">
                  <p>Condition: <strong className="capitalize">{rentalReturn.returnCondition.replace(/_/g, ' ')}</strong></p>
                  <p>Late Days: <strong>{rentalReturn.lateDays}</strong></p>
                  <p>Deposit Refund: <strong>{formatMoney(rentalReturn.depositRefundAmount, cur, sym)}</strong></p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        bookingId={booking._id}
        bookingReference={booking.bookingReference}
        amount={booking.pricing.totalAmount}
        currency={cur}
        currencySymbol={sym}
        onSuccess={() => refetch()}
      />
    </Wrapper>
  );
}
