import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Card } from '../../components/common/Card';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { formatDate, formatMoney } from '../../utils/format';

export function CustomerPaymentsInvoicesPage() {
  const { data: payments = [] } = useQuery({
    queryKey: ['customer-payments'],
    queryFn: async () => (await api.get('/payments')).data.data,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['customer-invoices'],
    queryFn: async () => (await api.get('/invoices')).data.data,
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
      toast.error(getApiErrorMessage(err));
    }
  };

  return (
    <CustomerLayout title="Payments & Invoices">
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Downloadable Tax Invoices</h2>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Invoices are generated automatically once a booking payment is verified." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Invoice #</Th>
                  <Th>Booking Ref</Th>
                  <Th>Provider</Th>
                  <Th>Issued On</Th>
                  <Th>Total</Th>
                  <Th className="text-right">PDF</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv: {
                  _id: string;
                  invoiceNumber: string;
                  issuedAt: string;
                  totalAmount: number;
                  currency: string;
                  currencySymbol: string;
                  bookingId?: { bookingReference?: string };
                  companyId?: { name?: string };
                }) => (
                  <tr key={inv._id}>
                    <Td className="font-mono font-bold text-slate-900">{inv.invoiceNumber}</Td>
                    <Td>{inv.bookingId?.bookingReference}</Td>
                    <Td>{inv.companyId?.name}</Td>
                    <Td>{formatDate(inv.issuedAt)}</Td>
                    <Td className="font-semibold">{formatMoney(inv.totalAmount, inv.currency, inv.currencySymbol)}</Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Download className="h-3.5 w-3.5" />}
                        onClick={() => downloadPdf(inv._id, inv.invoiceNumber)}
                      >
                        Download PDF
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">Payment History</h2>
          {payments.length === 0 ? (
            <Card><p className="text-xs text-slate-500">No payment attempts recorded yet.</p></Card>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Order ID</Th>
                  <Th>Booking</Th>
                  <Th>Gateway</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p: {
                  _id: string;
                  orderId: string;
                  gateway: string;
                  amount: number;
                  currency: string;
                  status: string;
                  bookingId?: { bookingReference?: string };
                }) => (
                  <tr key={p._id}>
                    <Td className="font-mono text-xs">{p.orderId}</Td>
                    <Td className="font-semibold">{p.bookingId?.bookingReference}</Td>
                    <Td><Badge tone="neutral">{p.gateway}</Badge></Td>
                    <Td className="font-semibold">{formatMoney(p.amount, p.currency)}</Td>
                    <Td><Badge tone={getStatusBadgeTone(p.status === 'captured' ? 'paid' : p.status)}>{p.status}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </CustomerLayout>
  );
}
