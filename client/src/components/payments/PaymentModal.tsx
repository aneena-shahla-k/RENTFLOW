import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, ShieldCheck, AlertCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { api, getApiErrorMessage } from '../../services/api';
import { formatMoney } from '../../utils/format';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  bookingReference: string;
  amount: number;
  currency?: string;
  currencySymbol?: string;
  onSuccess: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaymentModal({
  open,
  onClose,
  bookingId,
  bookingReference,
  amount,
  currency = 'INR',
  currencySymbol = '₹',
  onSuccess,
}: PaymentModalProps) {
  const [step, setStep] = useState<'ready' | 'simulator'>('ready');
  const [loading, setLoading] = useState(false);
  const [simOrder, setSimOrder] = useState<{
    orderId: string;
    amount: number;
    currency: string;
  } | null>(null);

  const handleStartPayment = async () => {
    setLoading(true);
    try {
      const orderRes = await api.post('/payments/create-order', { bookingId });
      const data = orderRes.data.data;

      if (data.isSimulated) {
        setSimOrder({
          orderId: data.orderId,
          amount: data.amount,
          currency: data.currency,
        });
        setStep('simulator');
        setLoading(false);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        toast.error('Unable to load Razorpay Checkout script.');
        setLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'RentFlow',
        description: `Booking ${bookingReference}`,
        order_id: data.orderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await api.post('/payments/verify', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            toast.success('Payment verified and invoice generated!');
            onSuccess();
            onClose();
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Payment verification failed.'));
          }
        },
        theme: { color: '#4F46E5' },
      });
      rzp.open();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Unable to initiate payment.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatorPay = async (shouldFail = false) => {
    if (!simOrder) return;
    setLoading(true);
    try {
      if (shouldFail) {
        await api.post('/payments/verify', {
          orderId: simOrder.orderId,
          paymentId: 'pay_sim_failed',
          signature: 'invalid_tampered_signature',
        });
      } else {
        const sigRes = await api.post('/payments/dev-simulate-signature', {
          orderId: simOrder.orderId,
        });
        const { paymentId, signature } = sigRes.data.data;
        await api.post('/payments/verify', {
          orderId: simOrder.orderId,
          paymentId,
          signature,
        });
        toast.success('Simulated payment verified by backend!');
        setStep('ready');
        onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Payment failed verification.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complete Payment · ${bookingReference}`}
      description="All payment signatures are verified server-side before marking your booking as paid."
    >
      {step === 'ready' ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Payable Amount</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {formatMoney(amount, currency, currencySymbol)}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-brand-600" />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-brand-50/70 p-3 text-xs text-brand-900">
            <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
            <span>
              Your booking will be verified via cryptographic HMAC signature and an official PDF invoice will be issued immediately.
            </span>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleStartPayment} loading={loading}>
              Proceed to Pay
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">Development Payment Simulator</span>
                <Badge tone="warning">Test Mode Only</Badge>
              </div>
              <p>
                Razorpay API keys are not configured in <code>server/.env</code>. This simulator executes the exact backend order creation and HMAC-SHA256 signature verification pipeline.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-1.5 border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Order ID</span>
              <span className="font-mono font-semibold text-slate-900">{simOrder?.orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount</span>
              <span className="font-bold text-slate-900">
                {formatMoney(simOrder?.amount || 0, simOrder?.currency || currency, currencySymbol)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => handleSimulatorPay(true)} loading={loading}>
              Simulate Failed Signature
            </Button>
            <Button onClick={() => handleSimulatorPay(false)} loading={loading}>
              Simulate Successful Payment
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
