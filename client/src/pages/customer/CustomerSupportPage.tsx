import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { Company } from '../../types';
import { formatDateTime } from '../../utils/format';

export function CustomerSupportPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    companyId: '',
    category: 'booking',
    subject: '',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['public-companies'],
    queryFn: async () => (await api.get('/companies/public')).data.data,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['customer-tickets'],
    queryFn: async () => (await api.get('/support')).data.data,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      if (form.companyId) fd.append('companyId', form.companyId);
      fd.append('category', form.category);
      fd.append('subject', form.subject);
      fd.append('description', form.description);
      if (file) fd.append('attachment', file);
      return api.post('/support', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success('Support ticket opened!');
      setForm({ companyId: '', category: 'booking', subject: '', description: '' });
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['customer-tickets'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      api.post(`/support/${id}/reply`, { message }),
    onSuccess: (_res, vars) => {
      setReplyMap((m) => ({ ...m, [vars.id]: '' }));
      queryClient.invalidateQueries({ queryKey: ['customer-tickets'] });
    },
  });

  return (
    <CustomerLayout title="Customer Support">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-base font-bold text-slate-900 mb-4">Open Support Ticket</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-3.5"
          >
            <Select
              label="Rental Provider (Optional)"
              value={form.companyId}
              onChange={(e) => setForm({ ...form, companyId: e.target.value })}
            >
              <option value="">Platform / General Support</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
            <Select
              label="Issue Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="booking">Booking</option>
              <option value="payment">Payment</option>
              <option value="equipment">Equipment Condition</option>
              <option value="delivery">Delivery & Pickup</option>
              <option value="account">Account</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Subject"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <Textarea
              label="Describe Your Issue"
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Attachment (Optional Image)</label>
              <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
            </div>
            <Button type="submit" className="w-full" loading={createMutation.isPending}>
              Submit Ticket
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {tickets.length === 0 ? (
            <EmptyState title="No support tickets" description="Open a ticket on the left if you need help with a booking or payment." />
          ) : (
            tickets.map((t: {
              _id: string;
              ticketNumber: string;
              subject: string;
              status: string;
              category: string;
              messages: Array<{ senderName: string; message: string; createdAt: string }>;
            }) => (
              <Card key={t._id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs font-bold text-brand-600">{t.ticketNumber}</span>
                    <h3 className="text-sm font-bold text-slate-900">{t.subject}</h3>
                  </div>
                  <Badge tone={getStatusBadgeTone(t.status)}>{t.status.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 max-h-44 overflow-y-auto">
                  {t.messages.map((m, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-semibold">{m.senderName}: </span>
                      <span className="text-slate-700">{m.message}</span>
                      <span className="ml-2 text-[10px] text-slate-400">{formatDateTime(m.createdAt)}</span>
                    </div>
                  ))}
                </div>
                {t.status !== 'closed' && (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs"
                      placeholder="Reply to support..."
                      value={replyMap[t._id] || ''}
                      onChange={(e) => setReplyMap((m) => ({ ...m, [t._id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={!replyMap[t._id]}
                      onClick={() => replyMutation.mutate({ id: t._id, message: replyMap[t._id] })}
                    >
                      Send
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
