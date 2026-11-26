import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarSearch,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select, Textarea } from '../../components/common/Input';
import { Badge, getStatusBadgeTone } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Table, Td, Th, THead } from '../../components/common/Table';
import { TableSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Category, Product } from '../../types';
import { formatDate, formatMoney, resolveImageUrl } from '../../utils/format';

export function InventoryPage() {
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const cur = company?.settings?.currency || 'INR';
  const sym = company?.settings?.currencySymbol || '₹';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [availProduct, setAvailProduct] = useState<Product | null>(null);

  const [form, setForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    brand: '',
    model: '',
    description: '',
    pricePerDayMajor: 1000,
    pricePerWeekMajor: 6000,
    pricePerMonthMajor: 20000,
    securityDepositMajor: 2500,
    totalStock: 5,
    condition: 'excellent',
    location: 'Main Warehouse',
    status: 'active',
    images: [] as string[],
  });

  const [maintForm, setMaintForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    quantityBlocked: 1,
    reason: '',
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get('/categories')).data.data,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-products', page, search, statusFilter, categoryFilter, sort],
    queryFn: async () => {
      const res = await api.get('/products', {
        params: { page, limit: 10, search, status: statusFilter, categoryId: categoryFilter, sort },
      });
      return res.data.data as {
        items: Product[];
        pagination: { page: number; total: number; totalPages: number };
      };
    },
  });

  const { data: availData, refetch: refetchAvail } = useQuery({
    queryKey: ['product-avail-overview', availProduct?._id, maintForm.startDate, maintForm.endDate],
    enabled: Boolean(availProduct),
    queryFn: async () => {
      const res = await api.get(`/products/${availProduct!._id}/availability`, {
        params: { startDate: maintForm.startDate, endDate: maintForm.endDate },
      });
      return res.data.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        sku: form.sku,
        categoryId: form.categoryId,
        brand: form.brand,
        model: form.model,
        description: form.description,
        pricePerDay: Math.round(Number(form.pricePerDayMajor) * 100),
        pricePerWeek: form.pricePerWeekMajor ? Math.round(Number(form.pricePerWeekMajor) * 100) : undefined,
        pricePerMonth: form.pricePerMonthMajor ? Math.round(Number(form.pricePerMonthMajor) * 100) : undefined,
        securityDeposit: Math.round(Number(form.securityDepositMajor) * 100),
        totalStock: Number(form.totalStock),
        condition: form.condition,
        location: form.location,
        status: form.status,
        images: form.images,
      };
      if (editingProduct) {
        return api.patch(`/products/${editingProduct._id}`, payload);
      }
      return api.post('/products', payload);
    },
    onSuccess: () => {
      toast.success(editingProduct ? 'Product updated!' : 'Product added!');
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Product deleted.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const bulkMutation = useMutation({
    mutationFn: (status: string) => api.post('/products/bulk-status', { productIds: selectedIds, status }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      sku: '',
      categoryId: categories[0]?._id || '',
      brand: '',
      model: '',
      description: '',
      pricePerDayMajor: 1000,
      pricePerWeekMajor: 6000,
      pricePerMonthMajor: 20000,
      securityDepositMajor: 2500,
      totalStock: 5,
      condition: 'excellent',
      location: 'Main Warehouse',
      status: 'active',
      images: [],
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      sku: p.sku,
      categoryId: typeof p.categoryId === 'string' ? p.categoryId : p.categoryId?._id || '',
      brand: p.brand || '',
      model: p.model || '',
      description: p.description,
      pricePerDayMajor: Math.round(p.pricePerDay / 100),
      pricePerWeekMajor: p.pricePerWeek ? Math.round(p.pricePerWeek / 100) : 0,
      pricePerMonthMajor: p.pricePerMonth ? Math.round(p.pricePerMonth / 100) : 0,
      securityDepositMajor: Math.round(p.securityDeposit / 100),
      totalStock: p.totalStock,
      condition: p.condition,
      location: p.location || 'Main Warehouse',
      status: p.status,
      images: p.images || [],
    });
    setModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((file) => fd.append('images', file));
    try {
      const res = await api.post('/products/upload-images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({ ...prev, images: [...prev.images, ...res.data.data.urls] }));
      toast.success('Images uploaded.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Image upload failed.'));
    }
  };

  const addMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availProduct) return;
    try {
      await api.post(`/products/${availProduct._id}/maintenance`, maintForm);
      toast.success('Maintenance window scheduled.');
      setMaintForm((f) => ({ ...f, reason: '' }));
      refetchAvail();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  };

  const products = data?.items || [];

  return (
    <AdminLayout title="Inventory Management">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search name, SKU, brand..."
              leftIcon={<Search className="h-4 w-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <div className="w-40">
            <Select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="-createdAt">Newest First</option>
              <option value="pricePerDay">Price: Low to High</option>
              <option value="-pricePerDay">Price: High to Low</option>
              <option value="name">Name A–Z</option>
            </Select>
          </div>
        </div>

        <Button onClick={openCreateModal} icon={<Plus className="h-4 w-4" />}>
          Add Product
        </Button>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <Card padding="sm" className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-brand-50/60 border-brand-200">
          <span className="text-xs font-semibold text-brand-900">
            {selectedIds.length} product(s) selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('active')}>Set Active</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('maintenance')}>Set Maintenance</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate('archived')}>Archive</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <ErrorState message={getApiErrorMessage(error)} onRetry={() => refetch()} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found. Add your first rental product."
          description="Create rentable items with SKU tracking, daily/weekly/monthly pricing, and security deposits."
          actionLabel="Add Product"
          onAction={openCreateModal}
        />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === products.length && products.length > 0}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? products.map((p) => p._id) : [])
                    }
                  />
                </Th>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th>Daily Rate</Th>
                <Th>Stock</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50/70">
                  <Td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p._id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, p._id] : prev.filter((id) => id !== p._id)
                        )
                      }
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {p.images?.[0] ? (
                          <img src={resolveImageUrl(p.images[0])} alt={p.name} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-500">SKU: {p.sku} · {p.location}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{typeof p.categoryId === 'string' ? '—' : p.categoryId?.name}</Td>
                  <Td className="font-semibold">{formatMoney(p.pricePerDay, cur, sym)}</Td>
                  <Td>
                    <span className="font-semibold text-slate-900">{p.availableStock}</span>
                    <span className="text-slate-400"> / {p.totalStock}</span>
                  </Td>
                  <Td>
                    <Badge tone={getStatusBadgeTone(p.status)}>{p.status}</Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Availability & Maintenance"
                        onClick={() => setAvailProduct(p)}
                        icon={<CalendarSearch className="h-3.5 w-3.5" />}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(p)}
                        icon={<Edit3 className="h-3.5 w-3.5" />}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(p)}
                        icon={<Trash2 className="h-3.5 w-3.5 text-rose-600" />}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {data?.pagination.page} of {data?.pagination.totalPages} ({data?.pagination.total} items)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= (data?.pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Product Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? `Edit ${editingProduct.name}` : 'Add Rental Product'}
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Product Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="SKU" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Select label="Category" required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </Select>
            <Input label="Warehouse Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Input label="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <Input label="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>

          <Textarea label="Description" required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label={`Daily (${sym})`} type="number" required min={0} value={form.pricePerDayMajor} onChange={(e) => setForm({ ...form, pricePerDayMajor: Number(e.target.value) })} />
            <Input label={`Weekly (${sym})`} type="number" min={0} value={form.pricePerWeekMajor} onChange={(e) => setForm({ ...form, pricePerWeekMajor: Number(e.target.value) })} />
            <Input label={`Monthly (${sym})`} type="number" min={0} value={form.pricePerMonthMajor} onChange={(e) => setForm({ ...form, pricePerMonthMajor: Number(e.target.value) })} />
            <Input label={`Deposit (${sym})`} type="number" min={0} value={form.securityDepositMajor} onChange={(e) => setForm({ ...form, securityDepositMajor: Number(e.target.value) })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Total Stock Qty" type="number" required min={0} value={form.totalStock} onChange={(e) => setForm({ ...form, totalStock: Number(e.target.value) })} />
            <Select label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
              <option value="new">New</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Product Images</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.images.map((url, idx) => (
                <div key={idx} className="relative h-16 w-20 rounded-xl border border-slate-200 overflow-hidden">
                  <img src={resolveImageUrl(url)} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                    className="absolute right-1 top-1 rounded bg-slate-900/70 px-1 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Upload className="h-4 w-4" /> Upload Images
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Availability & Maintenance Modal */}
      <Modal
        open={Boolean(availProduct)}
        onClose={() => setAvailProduct(null)}
        title={`Availability & Maintenance · ${availProduct?.name || ''}`}
        size="lg"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Check From"
              type="date"
              value={maintForm.startDate}
              onChange={(e) => setMaintForm({ ...maintForm, startDate: e.target.value })}
            />
            <Input
              label="Check To"
              type="date"
              value={maintForm.endDate}
              onChange={(e) => setMaintForm({ ...maintForm, endDate: e.target.value })}
            />
          </div>

          {availData?.availability && (
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Total Stock</p>
                <p className="text-lg font-bold text-slate-900">{availData.availability.totalStock}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Peak Reserved / Maint.</p>
                <p className="text-lg font-bold text-amber-700">{availData.availability.maxReservedInRange}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Available for Range</p>
                <p className="text-lg font-bold text-emerald-700">{availData.availability.availableQuantity}</p>
              </div>
            </div>
          )}

          <form onSubmit={addMaintenance} className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-brand-600" /> Schedule Maintenance Hold
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Units Blocked"
                type="number"
                min={1}
                max={availProduct?.totalStock || 1}
                value={maintForm.quantityBlocked}
                onChange={(e) => setMaintForm({ ...maintForm, quantityBlocked: Number(e.target.value) })}
              />
              <div className="sm:col-span-2">
                <Input
                  label="Maintenance Reason"
                  required
                  placeholder="Sensor cleaning / calibration"
                  value={maintForm.reason}
                  onChange={(e) => setMaintForm({ ...maintForm, reason: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" size="sm">Schedule Hold</Button>
          </form>

          {availData?.maintenancePeriods?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">Maintenance Windows</h4>
              {availData.maintenancePeriods.map((m: {
                _id: string;
                startDate: string;
                endDate: string;
                quantityBlocked: number;
                reason: string;
                status: string;
              }) => (
                <div key={m._id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{m.reason}</span>
                    <span className="ml-2 text-slate-500">
                      ({formatDate(m.startDate)} → {formatDate(m.endDate)}, {m.quantityBlocked} unit(s))
                    </span>
                  </div>
                  <Badge tone={getStatusBadgeTone(m.status)}>{m.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget._id)}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
      />
    </AdminLayout>
  );
}
