import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle2, ShoppingBag, Star, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { ErrorState } from '../../components/common/ErrorState';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { useCart } from '../../store/cartContext';
import { Company, PriceBreakdown, Product } from '../../types';
import { formatDate, formatMoney, resolveImageUrl } from '../../utils/format';

export function ProductDetailPage({ isPublic = false }: { isPublic?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { addItem } = useCart();

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const plus3 = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(tomorrow);
  const [endDate, setEndDate] = useState(plus3);
  const [quantity, setQuantity] = useState(1);
  const [checking, setChecking] = useState(false);
  const [availResult, setAvailResult] = useState<{
    available: boolean;
    rentalDays: number;
    availableQuantity: number;
    reason?: string;
    pricing: PriceBreakdown;
  } | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: async () => (await api.get(`/products/public/${id}`)).data.data,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['product-reviews', id],
    queryFn: async () => (await api.get(`/reviews/product/${id}`)).data.data,
  });

  const handleCheckAvailability = async () => {
    setChecking(true);
    try {
      const res = await api.post('/bookings/check-availability', {
        startDate,
        endDate,
        items: [{ productId: id, quantity: Number(quantity) }],
        fulfillmentType: 'pickup',
      });
      const d = res.data.data;
      setAvailResult({
        available: d.available,
        rentalDays: d.rentalDays,
        availableQuantity: d.items[0]?.availableQuantity ?? 0,
        reason: d.items[0]?.reason,
        pricing: d.pricing,
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not check availability.'));
    } finally {
      setChecking(false);
    }
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated || user?.role !== 'customer') {
      toast.info('Please sign in with a customer account to book equipment.');
      navigate('/login');
      return;
    }
    if (!availResult?.available) {
      toast.error('Please verify date availability first.');
      return;
    }
    const res = addItem({
      product: data.product,
      quantity: Number(quantity),
      startDate,
      endDate,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Added to booking cart!');
    navigate('/customer/cart');
  };

  const product: Product | undefined = data?.product;
  const company: Company | undefined =
    product && typeof product.companyId !== 'string' ? product.companyId : undefined;
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const body = isLoading ? (
    <DashboardSkeleton />
  ) : isError || !product ? (
    <ErrorState message={getApiErrorMessage(error, 'Product not found')} />
  ) : (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Images + Details */}
        <div className="lg:col-span-7 space-y-5">
          <Card padding="none" className="overflow-hidden">
            <div className="h-72 sm:h-96 bg-slate-100">
              {product.images?.[0] ? (
                <img
                  src={resolveImageUrl(product.images[0])}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">
                {typeof product.categoryId === 'string' ? 'Equipment' : product.categoryId?.name}
              </Badge>
              <Badge tone="neutral">SKU: {product.sku}</Badge>
              <Badge tone="success" className="capitalize">Condition: {product.condition}</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">{product.name}</h1>
            <p className="mt-1 text-xs text-slate-500">
              Provided by <strong>{company?.name}</strong> · {product.location} · Total Fleet: {product.totalStock} units
            </p>
            <p className="mt-4 text-sm text-slate-700 leading-relaxed">{product.description}</p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200/70">
              <div>
                <p className="text-[11px] text-slate-500">Daily Rate</p>
                <p className="text-sm font-bold text-slate-900">{formatMoney(product.pricePerDay, cur, sym)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Weekly Rate</p>
                <p className="text-sm font-bold text-slate-900">
                  {product.pricePerWeek ? formatMoney(product.pricePerWeek, cur, sym) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Monthly Rate</p>
                <p className="text-sm font-bold text-slate-900">
                  {product.pricePerMonth ? formatMoney(product.pricePerMonth, cur, sym) : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Security Deposit</p>
                <p className="text-sm font-bold text-slate-900">{formatMoney(product.securityDeposit, cur, sym)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Date Availability Checker & Pricing */}
        <div className="lg:col-span-5 space-y-5">
          <Card>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-brand-600" /> Check Availability & Price
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Dates are inclusive UTC calendar days. Availability is validated live on the server.
            </p>

            <div className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setAvailResult(null);
                  }}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setAvailResult(null);
                  }}
                />
              </div>
              <Input
                label="Quantity"
                type="number"
                min={1}
                max={product.totalStock}
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  setAvailResult(null);
                }}
              />
              <Button
                variant="secondary"
                className="w-full"
                loading={checking}
                onClick={handleCheckAvailability}
              >
                Check Live Availability
              </Button>
            </div>

            {availResult && (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                {availResult.available ? (
                  <div className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Available for your dates!</p>
                      <p>{availResult.availableQuantity} unit(s) free across {availResult.rentalDays} day(s).</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
                    <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Dates Unavailable</p>
                      <p>{availResult.reason || 'These dates are unavailable. Please choose another rental period.'}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Rental Subtotal ({availResult.rentalDays} days)</span>
                    <span className="font-semibold">{formatMoney(availResult.pricing.rentalSubtotal, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">GST / Tax ({availResult.pricing.taxRate}%)</span>
                    <span className="font-semibold">{formatMoney(availResult.pricing.taxAmount, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Refundable Deposit</span>
                    <span className="font-semibold">{formatMoney(availResult.pricing.securityDeposit, cur, sym)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                    <span>Estimated Total</span>
                    <span>{formatMoney(availResult.pricing.totalAmount, cur, sym)}</span>
                  </div>
                </div>

                {availResult.available && (
                  <Button
                    className="w-full"
                    size="lg"
                    icon={<ShoppingBag className="h-4 w-4" />}
                    onClick={handleAddToCart}
                  >
                    Add to Booking Cart
                  </Button>
                )}
              </div>
            )}
          </Card>

          {data?.maintenancePeriods?.length > 0 && (
            <Card>
              <h3 className="text-xs font-bold text-slate-700 mb-2">Scheduled Maintenance Holds</h3>
              <div className="space-y-1.5 text-xs text-slate-600">
                {data.maintenancePeriods.map((m: { _id: string; startDate: string; endDate: string; quantityBlocked: number }) => (
                  <div key={m._id} className="flex justify-between">
                    <span>{formatDate(m.startDate)} → {formatDate(m.endDate)}</span>
                    <span>{m.quantityBlocked} unit(s)</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Verified Reviews */}
      <Card>
        <h2 className="text-base font-bold text-slate-900 mb-4">
          Verified Rental Reviews ({reviews.length})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-xs text-slate-500">No verified customer reviews yet for this product.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reviews.map((r: { _id: string; rating: number; comment: string; customerId?: { name?: string }; createdAt: string }) => (
              <div key={r._id} className="rounded-2xl bg-slate-50 p-4 space-y-2 border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{r.customerId?.name || 'Verified Renter'}</span>
                  <Badge tone="success">Verified Rental</Badge>
                </div>
                <div className="flex items-center gap-0.5 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-slate-700">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

  if (!isPublic) {
    return <CustomerLayout title={product?.name || 'Product Details'}>{body}</CustomerLayout>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link to="/catalog"><Button size="sm" variant="ghost">Back to Catalog</Button></Link>
            <Link to="/login"><Button size="sm">Login to Book</Button></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">{body}</main>
    </div>
  );
}
