import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerLayout } from './CustomerLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';

export function CustomerProfilePage() {
  const { user, refreshSession } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [addr, setAddr] = useState({
    label: 'Office',
    street: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    phone: user?.phone || '',
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['customer-addresses'],
    queryFn: async () => (await api.get('/customers/addresses')).data.data,
  });

  const updateProfile = useMutation({
    mutationFn: () => api.patch('/auth/profile', { name, phone }),
    onSuccess: async () => {
      await refreshSession();
      toast.success('Profile updated!');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const addAddress = useMutation({
    mutationFn: () => api.post('/customers/addresses', addr),
    onSuccess: () => {
      toast.success('Address saved!');
      setAddr({ label: 'Home', street: '', city: '', state: '', country: 'India', postalCode: '', phone: user?.phone || '' });
      queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <CustomerLayout title="Profile & Saved Addresses">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-base font-bold text-slate-900 mb-4">Personal Information</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProfile.mutate();
            }}
            className="space-y-4"
          >
            <Input label="Full Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email Address" disabled value={user?.email || ''} />
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={updateProfile.isPending}>Save Profile</Button>
          </form>
        </Card>

        <Card className="space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-600" /> Delivery Addresses
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addAddress.mutate();
            }}
            className="space-y-3 border-b border-slate-100 pb-5"
          >
            <div className="grid grid-cols-2 gap-3">
              <Input label="Label" required value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} />
              <Input label="Phone" required value={addr.phone} onChange={(e) => setAddr({ ...addr, phone: e.target.value })} />
            </div>
            <Input label="Street" required value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="City" required value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              <Input label="State" required value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} />
              <Input label="Postal Code" required value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} />
            </div>
            <Button type="submit" size="sm" loading={addAddress.isPending}>Add Address</Button>
          </form>

          <div className="space-y-2">
            {addresses.map((a: { _id: string; label: string; street: string; city: string; state: string; postalCode: string }) => (
              <div key={a._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{a.label}</p>
                  <p className="text-slate-600">{a.street}, {a.city}, {a.state} {a.postalCode}</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.delete(`/customers/addresses/${a._id}`);
                    queryClient.invalidateQueries({ queryKey: ['customer-addresses'] });
                    toast.success('Address removed.');
                  }}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </CustomerLayout>
  );
}
