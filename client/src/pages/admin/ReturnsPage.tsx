import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Booking } from '../../types';
import { formatDate, formatMoney } from '../../utils/format';

export function ReturnsPage() {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const [form, setForm] = useState({
    bookingId: '',
    actualReturnDate: new Date().toISOString().slice(0, 10),
    returnCondition: 'good',
    damageReport: '',
    missingAccessories: '',
    damageFeeMajor: 0,
    additionalChargesMajor: 0,
    putProductsInMaintenance: false,
    notes: '',
  });

  const { data: returns = [] } = useQuery({
    queryKey: ['admin-returns'],
    queryFn: async () => (await api.get('/returns')).data.data,
  });

  const { data: activeBookingsData } = useQuery({
    queryKey: ['admin-bookings-for-return'],
    queryFn: async () => {
      const res = await api.get('/bookings', { params: { limit: 50 } });
      return (res.data.data.items as Booking[]).filter((b) =>
        ['active_rental', 'out_for_delivery', 'return_requested', 'overdue', 'paid'].includes(b.status)
      );
    },
  });

  const processMutation = useMutation({
    mutationFn: () =>
      api.post('/returns', {
        bookingId: form.bookingId,
        actualReturnDate: form.actualReturnDate,
        returnCondition: form.returnCondition,
        damageReport: form.damageReport || undefined,
        missingAccessories: form.missingAccessories || undefined,
        damageFeeAmount: Math.round(Number(form.damageFeeMajor) * 100),
        additionalCharges: Math.round(Number(form.additionalChargesMajor) * 100),
        putProductsInMaintenance: form.putProductsInMaintenance,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Return processed and inventory updated!');
      setForm((f) => ({ ...f, bookingId: '', damageReport: '', missingAccessories: '', damageFeeMajor: 0, additionalChargesMajor: 0, putProductsInMaintenance: false }));
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-for-return'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <AdminLayout title="Rental Return Management">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-brand-600" /> Process Equipment Return
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processMutation.mutate();
            }}
            className="space-y-3.5"
          >
            <Select
              label="Select Booking"
              required
              value={form.bookingId}
              onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
            >
              <option value="">Choose active booking...</option>
              {(activeBookingsData || []).map((b) => (
                <option key={b._id} value={b._id}>
                  {b.bookingReference} (Due {formatDate(b.endDate)})
                </option>
              ))}
            </Select>
            <Input
              label="Actual Return Date"
              type="date"
              required
              value={form.actualReturnDate}
              onChange={(e) => setForm({ ...form, actualReturnDate: e.target.value })}
            />
            <Select
              label="Return Condition"
              value={form.returnCondition}
              onChange={(e) =>
                setForm({
                  ...form,
                  returnCondition: e.target.value,
                  putProductsInMaintenance: e.target.value === 'damaged' || e.target.value === 'missing_items',
                })
              }
            >
              <option value="good">Good Condition</option>
              <option value="minor_wear">Minor Wear</option>
              <option value="damaged">Damaged (Auto-Maintenance)</option>
              <option value="missing_items">Missing Accessories (Hold)</option>
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Damage Fee (${sym})`}
                type="number"
                min={0}
                value={form.damageFeeMajor}
                onChange={(e) => setForm({ ...form, damageFeeMajor: Number(e.target.value) })}
              />
              <Input
                label={`Extra Charges (${sym})`}
                type="number"
                min={0}
                value={form.additionalChargesMajor}
                onChange={(e) => setForm({ ...form, additionalChargesMajor: Number(e.target.value) })}
              />
            </div>

            <Input
              label="Missing Accessories"
              value={form.missingAccessories}
              onChange={(e) => setForm({ ...form, missingAccessories: e.target.value })}
              placeholder="e.g. Lens hood / charger"
            />
            <Textarea
              label="Damage / Inspection Report"
              rows={2}
              value={form.damageReport}
              onChange={(e) => setForm({ ...form, damageReport: e.target.value })}
            />

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.putProductsInMaintenance}
                onChange={(e) => setForm({ ...form, putProductsInMaintenance: e.target.checked })}
              />
              Hold product in maintenance (do not auto-release for rent)
            </label>

            <Button type="submit" className="w-full" loading={processMutation.isPending}>
              Complete Return & Settle Deposit
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          {returns.length === 0 ? (
            <EmptyState
              title="No returns processed yet"
              description="Processed returns, late fee calculations, and deposit refund records will appear here."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Booking</Th>
                  <Th>Returned On</Th>
                  <Th>Condition</Th>
                  <Th>Late Days / Fee</Th>
                  <Th>Deposit Refund</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {returns.map((r: {
                  _id: string;
                  bookingId?: { bookingReference?: string };
                  customerId?: { name?: string };
                  actualReturnDate: string;
                  returnCondition: string;
                  lateDays: number;
                  lateFeeAmount: number;
                  depositRefundAmount: number;
                  depositRefundStatus: string;
                }) => (
                  <tr key={r._id}>
                    <Td>
                      <p className="font-mono font-bold text-slate-900">{r.bookingId?.bookingReference}</p>
                      <p className="text-xs text-slate-500">{r.customerId?.name}</p>
                    </Td>
                    <Td>{formatDate(r.actualReturnDate)}</Td>
                    <Td>
                      <Badge tone={getStatusBadgeTone(r.returnCondition === 'good' ? 'completed' : 'warning')}>
                        {r.returnCondition.replace(/_/g, ' ')}
                      </Badge>
                    </Td>
                    <Td className="text-xs">
                      {r.lateDays} day(s) · {formatMoney(r.lateFeeAmount, cur, sym)}
                    </Td>
                    <Td>
                      <p className="font-semibold">{formatMoney(r.depositRefundAmount, cur, sym)}</p>
                      <Badge tone={getStatusBadgeTone(r.depositRefundStatus === 'refunded' ? 'completed' : 'warning')}>
                        {r.depositRefundStatus.replace(/_/g, ' ')}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
