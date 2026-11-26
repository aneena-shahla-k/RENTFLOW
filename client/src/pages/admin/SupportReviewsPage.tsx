import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { formatDateTime } from '../../utils/format';

export function SupportReviewsPage() {
  const queryClient = useQueryClient();
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const { data: tickets = [] } = useQuery({
    queryKey: ['admin-tickets'],
    queryFn: async () => (await api.get('/support')).data.data,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => (await api.get('/reviews')).data.data,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api.post(`/support/${id}/reply`, { message }),
    onSuccess: (_res, vars) => {
      toast.success('Reply sent.');
      setReplyMap((m) => ({ ...m, [vars.id]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const updateTicketStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/support/${id}`, { status }),
    onSuccess: () => {
      toast.success('Ticket status updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    },
  });

  const moderateMutation = useMutation({
    mutationFn: ({ id, moderationStatus }: { id: string; moderationStatus: string }) =>
      api.patch(`/reviews/${id}/moderate`, { moderationStatus }),
    onSuccess: () => {
      toast.success('Review moderation updated.');
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });

  return (
    <AdminLayout title="Support Tickets & Verified Reviews">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Support Tickets */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Customer Support Tickets</h2>
          {tickets.length === 0 ? (
            <EmptyState title="No support tickets" description="Customer support enquiries will appear here." />
          ) : (
            tickets.map((t: {
              _id: string;
              ticketNumber: string;
              subject: string;
              category: string;
              status: string;
              customerId?: { name?: string };
              messages: Array<{ senderName: string; message: string; createdAt: string }>;
            }) => (
              <Card key={t._id} className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-brand-600">{t.ticketNumber}</span>
                    <h3 className="text-sm font-bold text-slate-900">{t.subject}</h3>
                    <p className="text-xs text-slate-500">From: {t.customerId?.name} · Category: {t.category}</p>
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    value={t.status}
                    onChange={(e) => updateTicketStatus.mutate({ id: t._id, status: e.target.value })}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_for_customer">Waiting for Customer</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl bg-slate-50 p-3">
                  {t.messages.map((m, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-semibold text-slate-900">{m.senderName}: </span>
                      <span className="text-slate-700">{m.message}</span>
                      <span className="ml-2 text-[10px] text-slate-400">{formatDateTime(m.createdAt)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                    placeholder="Write reply..."
                    value={replyMap[t._id] || ''}
                    onChange={(e) => setReplyMap((m) => ({ ...m, [t._id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    disabled={!replyMap[t._id]}
                    onClick={() => replyMutation.mutate({ id: t._id, message: replyMap[t._id] })}
                  >
                    Reply
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Verified Reviews Moderation */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Product Reviews Moderation</h2>
          {reviews.length === 0 ? (
            <EmptyState title="No customer reviews yet" description="Verified post-rental reviews will appear here." />
          ) : (
            reviews.map((r: {
              _id: string;
              rating: number;
              comment: string;
              moderationStatus: string;
              customerId?: { name?: string };
              productId?: { name?: string };
            }) => (
              <Card key={r._id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{r.productId?.name}</p>
                    <p className="text-xs text-slate-500">By {r.customerId?.name} · Verified Rental</p>
                  </div>
                  <Badge tone={getStatusBadgeTone(r.moderationStatus)}>{r.moderationStatus}</Badge>
                </div>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-slate-700">{r.comment}</p>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderateMutation.mutate({ id: r._id, moderationStatus: 'approved' })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moderateMutation.mutate({ id: r._id, moderationStatus: 'rejected' })}
                  >
                    Hide
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
