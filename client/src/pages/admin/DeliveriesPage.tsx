import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { api, getApiErrorMessage } from '../../services/api';
import { formatDate } from '../../utils/format';

export function DeliveriesPage() {
  const queryClient = useQueryClient();

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['admin-deliveries'],
    queryFn: async () => (await api.get('/deliveries')).data.data,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['company-staff'],
    queryFn: async () => (await api.get('/staff')).data.data,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      api.patch(`/deliveries/${id}`, payload),
    onSuccess: () => {
      toast.success('Delivery updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-deliveries'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <AdminLayout title="Delivery & Pickup Management">
      {isLoading ? (
        <TableSkeleton />
      ) : deliveries.length === 0 ? (
        <EmptyState
          title="No deliveries or pickups scheduled"
          description="Fulfillment records appear automatically when bookings are submitted."
        />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Booking</Th>
              <Th>Type</Th>
              <Th>Address</Th>
              <Th>Assigned Staff</Th>
              <Th>Status</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {deliveries.map((d: {
              _id: string;
              bookingId?: { bookingReference?: string; startDate?: string };
              customerId?: { name?: string; phone?: string };
              fulfillmentType: string;
              status: string;
              assignedStaffId?: { _id?: string; name?: string };
              address?: { street?: string; city?: string };
            }) => (
              <tr key={d._id}>
                <Td>
                  <p className="font-mono font-bold text-slate-900">{d.bookingId?.bookingReference}</p>
                  <p className="text-xs text-slate-500">
                    {d.customerId?.name} · {formatDate(d.bookingId?.startDate)}
                  </p>
                </Td>
                <Td className="capitalize font-medium">{d.fulfillmentType}</Td>
                <Td className="text-xs text-slate-600">
                  {d.address?.street ? `${d.address.street}, ${d.address.city}` : 'Customer Pickup at Hub'}
                </Td>
                <Td>
                  <select
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs bg-white"
                    value={d.assignedStaffId?._id || ''}
                    onChange={(e) =>
                      updateMutation.mutate({ id: d._id, payload: { assignedStaffId: e.target.value } })
                    }
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((m: { _id: string; userId?: { _id: string; name: string } }) => (
                      <option key={m._id} value={m.userId?._id}>
                        {m.userId?.name}
                      </option>
                    ))}
                  </select>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Badge tone={getStatusBadgeTone(d.status)}>{d.status.replace(/_/g, ' ')}</Badge>
                    <select
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs bg-white"
                      value={d.status}
                      onChange={(e) =>
                        updateMutation.mutate({ id: d._id, payload: { status: e.target.value } })
                      }
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="dispatched">Dispatched</option>
                      <option value="delivered">Delivered</option>
                      <option value="pickup_scheduled">Pickup Scheduled</option>
                      <option value="collected">Collected</option>
                    </select>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminLayout>
  );
}
