import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from './AdminLayout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { api, getApiErrorMessage } from '../../services/api';
import { Category } from '../../types';

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get('/categories')).data.data,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/categories', {
        name,
        description,
        parentId: parentId || null,
      }),
    onSuccess: () => {
      toast.success('Category added!');
      setName('');
      setDescription('');
      setParentId('');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      toast.success('Category removed.');
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  return (
    <AdminLayout title="Categories & Subcategories">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="text-base font-bold text-slate-900 mb-4">New Category</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <Input
              label="Category Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cinema Lenses"
            />
            <Select
              label="Parent Category (Optional for Subcategory)"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (Top-Level Category)</option>
              {categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
            </Select>
            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional summary..."
            />
            <Button type="submit" className="w-full" loading={createMutation.isPending} icon={<FolderPlus className="h-4 w-4" />}>
              Create Category
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-base font-bold text-slate-900 mb-4">Active Categories ({categories.length})</h2>
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading categories...</p>
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Add your first category to organize rental inventory."
              />
            ) : (
              <div className="divide-y divide-slate-100">
                {categories.map((cat) => {
                  const parent = categories.find((p) => p._id === cat.parentId);
                  return (
                    <div key={cat._id} className="flex items-center justify-between py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{cat.name}</span>
                          {parent && <Badge tone="neutral">Subcategory of {parent.name}</Badge>}
                        </div>
                        {cat.description && <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(cat._id)}
                        icon={<Trash2 className="h-4 w-4 text-rose-600" />}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
