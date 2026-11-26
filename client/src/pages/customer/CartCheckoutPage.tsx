import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Textarea } from '../../components/common/Input';
import { EmptyState } from '../../components/common/EmptyState';
import { PaymentModal } from '../../components/payments/PaymentModal';
import { api, getApiErrorMessage } from '../../services/api';
import { useCart } from '../../store/cartContext';
import { Company, PriceBreakdown } from '../../types';
import { formatDate, formatMoney, resolveImageUrl } from '../../utils/format';

export function CartCheckoutPage() {
  const { items, removeItem, updateItemQuantity, clearCart } = useCart();
  const navigate = useNavigate();

  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    phone: '',
  });

  const [pricing, setPricing] = useState<PriceBreakdown | null>(null);
  const [available, setAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [createdBooking, setCreatedBooking] = useState<{
    _id: string;
    bookingReference: string;
    totalAmount: number;
  } | null>(null);

  const firstComp = items[0]?.product.companyId;
  const companyObj = typeof firstComp === 'object' ? (firstComp as Company) : null;
  const deliveryEnabled = companyObj?.settings?.deliveryEnabled ?? true;
  const cur = companyObj?.settings?.currency || 'INR';
  const sym = companyObj?.settings?.currencySymbol || '₹';

  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: async () => (await api.get('/customers/addresses')).data.data,
  });

  useEffect(() => {
    if (items.length === 0) {
      setPricing(null);
      return;
    }
    api
      .post('/bookings/check-availability', {
        startDate: items[0].startDate,
        endDate: items[0].endDate,
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity })),
        fulfillmentType,
      })
      .then((res) => {
        setPricing(res.data.data.pricing);
        setAvailable(res.data.data.available);
      })
      .catch(() => {
        setAvailable(false);
      });
  }, [items, fulfillmentType]);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (fulfillmentType === 'delivery' && (!address.street || !address.city || !address.postalCode)) {
      toast.error('Please enter your complete delivery address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/bookings', {
        startDate: items[0].startDate,
        endDate: items[0].endDate,
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity })),
        fulfillmentType,
        deliveryAddress: fulfillmentType === 'delivery' ? address : undefined,
        notes: notes || undefined,
      });
      const booking = res.data.data.booking;
      clearCart();
      toast.success(`Booking ${booking.bookingReference} submitted!`);
      setCreatedBooking({
        _id: booking._id,
        bookingReference: booking.bookingReference,
        totalAmount: booking.pricing.totalAmount,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to submit booking.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerLayout title="Booking Cart & Checkout">
      {items.length === 0 && !createdBooking ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your booking cart is empty"
          description="Browse equipment, check live date availability, and add items to your cart."
          actionLabel="Browse Products"
          onAction={() => navigate('/customer/catalog')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-5">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Selected Equipment</h2>
                  {items[0] && (
                    <p className="text-xs text-slate-500">
                      Rental Period: {formatDate(items[0].startDate)} → {formatDate(items[0].endDate)}
                    </p>
                  )}
                </div>
                <Link to="/customer/catalog" className="text-xs font-semibold text-brand-600 hover:underline">
                  + Add more items
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.product._id} className="flex items-center justify-between gap-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-16 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                        {item.product.images?.[0] && (
                          <img src={resolveImageUrl(item.product.images[0])} alt={item.product.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.product.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatMoney(item.product.pricePerDay, cur, sym)} / day
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={item.product.totalStock}
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(item.product._id, Number(e.target.value))}
                        className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.product._id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <h2 className="text-base font-bold text-slate-900">Pickup or Delivery</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFulfillmentType('pickup')}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition-all ${
                    fulfillmentType === 'pickup'
                      ? 'border-brand-600 bg-brand-50 text-brand-900'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  Store Pickup (Free)
                </button>
                <button
                  type="button"
                  disabled={!deliveryEnabled}
                  onClick={() => setFulfillmentType('delivery')}
                  className={`rounded-xl border p-3 text-left text-xs font-semibold transition-all disabled:opacity-50 ${
                    fulfillmentType === 'delivery'
                      ? 'border-brand-600 bg-brand-50 text-brand-900'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  {deliveryEnabled ? 'Doorstep Delivery' : 'Delivery Unavailable'}
                </button>
              </div>

              {fulfillmentType === 'delivery' && (
                <div className="space-y-3 pt-2">
                  {savedAddresses.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {savedAddresses.map((a: { _id: string; label: string; street: string; city: string; state: string; postalCode: string; country: string; phone: string }) => (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => setAddress(a)}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs hover:border-brand-500"
                        >
                          Use {a.label}: {a.city}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input
                    label="Street Address"
                    required
                    value={address.street}
                    onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Input label="City" required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                    <Input label="State" required value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
                    <Input label="Postal Code" required value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} />
                    <Input label="Phone" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
                  </div>
                </div>
              )}

              <Textarea
                label="Booking Notes (Optional)"
                rows={2}
                placeholder="Pickup time preference or accessory requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card className="sticky top-24 space-y-4">
              <h2 className="text-base font-bold text-slate-900">Order Summary</h2>
              {pricing ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rental Subtotal ({pricing.rentalDays} days)</span>
                    <span className="font-semibold">{formatMoney(pricing.rentalSubtotal, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST / Tax ({pricing.taxRate}%)</span>
                    <span className="font-semibold">{formatMoney(pricing.taxAmount, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Delivery Charge</span>
                    <span className="font-semibold">{formatMoney(pricing.deliveryFee, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Security Deposit (Refundable)</span>
                    <span className="font-semibold">{formatMoney(pricing.securityDeposit, cur, sym)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-extrabold text-slate-900">
                    <span>Total Payable</span>
                    <span>{formatMoney(pricing.totalAmount, cur, sym)}</span>
                  </div>
                </div>
              ) : null}

              {!available && (
                <p className="rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700">
                  Selected quantity or dates are no longer available. Adjust quantity to continue.
                </p>
              )}

              <Button
                className="w-full"
                size="lg"
                disabled={!available || items.length === 0}
                loading={submitting}
                onClick={handleCheckout}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Submit Booking & Pay
              </Button>
            </Card>
          </div>
        </div>
      )}

      {createdBooking && (
        <PaymentModal
          open={Boolean(createdBooking)}
          onClose={() => {
            const id = createdBooking._id;
            setCreatedBooking(null);
            navigate(`/customer/bookings/${id}`);
          }}
          bookingId={createdBooking._id}
          bookingReference={createdBooking.bookingReference}
          amount={createdBooking.totalAmount}
          currency={cur}
          currencySymbol={sym}
          onSuccess={() => {
            const id = createdBooking._id;
            setCreatedBooking(null);
            navigate(`/customer/bookings/${id}`);
          }}
        />
      )}
    </CustomerLayout>
  );
}
