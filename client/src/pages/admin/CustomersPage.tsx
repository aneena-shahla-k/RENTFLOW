import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { Input } from '../../components/common/Input';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { formatDate, formatMoney } from '../../utils/format';

export function CustomersPage() {
  const { company } = useAuth();
  const [search, setSearch] = useState('');
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['company-customers'],
    queryFn: async () => (await api.get('/customers')).data.data,
  });

  const filtered = customers.filter(
    (c: { name: string; email: string }) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Customers Directory">
      <div className="mb-6 max-w-sm">
        <Input
          placeholder="Search customer name or email..."
          leftIcon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No customers found"
          description="Customers who book equipment from your workspace will appear here."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Customer</Th>
              <Th>Phone</Th>
              <Th>Total Bookings</Th>
              <Th>Total Spend</Th>
              <Th>Last Booking</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((c: {
              _id: string;
              name: string;
              email: string;
              phone?: string;
              bookingCount: number;
              totalSpent: number;
              lastBookingAt: string;
            }) => (
              <tr key={c._id}>
                <Td>
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </Td>
                <Td className="text-xs">{c.phone || '—'}</Td>
                <Td className="font-semibold">{c.bookingCount}</Td>
                <Td className="font-semibold">{formatMoney(c.totalSpent, cur, sym)}</Td>
                <Td className="text-xs text-slate-500">{formatDate(c.lastBookingAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminLayout>
  );
}
