import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Star } from 'lucide-react';
import { CustomerLayout } from './CustomerLayout';
import { Logo } from '../../components/common/Logo';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input, Select } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { EmptyState } from '../../components/common/EmptyState';
import { api } from '../../services/api';
import { useAuth } from '../../store/authContext';
import { Company, Product } from '../../types';
import { formatMoney, resolveImageUrl } from '../../utils/format';

export function CatalogPage({ isPublic = false }: { isPublic?: boolean }) {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['public-companies'],
    queryFn: async () => (await api.get('/companies/public')).data.data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['public-products', page, search, companyId, sort],
    queryFn: async () => {
      const res = await api.get('/products/public', {
        params: { page, limit: 12, search, companyId, sort },
      });
      return res.data.data as {
        items: Product[];
        pagination: { page: number; total: number; totalPages: number };
      };
    },
  });

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <Input
            placeholder="Search cameras, laptops, tools, lighting..."
            leftIcon={<Search className="h-4 w-4" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-52">
          <Select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Rental Companies</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="-createdAt">Featured</option>
            <option value="pricePerDay">Price: Low to High</option>
            <option value="-pricePerDay">Price: High to Low</option>
            <option value="-averageRating">Top Rated</option>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No rental products match your filter"
          description="Try clearing your search or selecting another rental provider."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((p) => {
              const comp = typeof p.companyId === 'string' ? null : p.companyId;
              const cat = typeof p.categoryId === 'string' ? null : p.categoryId;
              const cur = comp?.settings?.currency || 'INR';
              const sym = comp?.settings?.currencySymbol || '₹';
              const detailPath = isPublic && !isAuthenticated
                ? `/catalog/${p._id}`
                : `/customer/products/${p._id}`;

              return (
                <Card key={p._id} padding="none" hover className="overflow-hidden flex flex-col">
                  <Link to={detailPath} className="block h-44 bg-slate-100 overflow-hidden">
                    {p.images?.[0] ? (
                      <img
                        src={resolveImageUrl(p.images[0])}
                        alt={p.name}
                        className="h-full w-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : null}
                  </Link>
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone="brand">{cat?.name || 'Rental'}</Badge>
                        {p.reviewCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                            <Star className="h-3.5 w-3.5 fill-current" /> {p.averageRating}
                          </span>
                        )}
                      </div>
                      <Link to={detailPath}>
                        <h3 className="mt-2 text-sm font-bold text-slate-900 hover:text-brand-600 line-clamp-1">
                          {p.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {comp?.name} {comp?.address?.city ? `· ${comp.address.city}` : ''}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-base font-extrabold text-slate-900">
                          {formatMoney(p.pricePerDay, cur, sym)}
                        </span>
                        <span className="text-[11px] text-slate-500"> / day</span>
                      </div>
                      <Link to={detailPath}>
                        <Button size="sm" variant="outline">Check Dates</Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} items)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (!isPublic) {
    return <CustomerLayout title="Browse Rental Catalog">{content}</CustomerLayout>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/customer"><Button size="sm">Customer Portal</Button></Link>
            ) : (
              <>
                <Link to="/login"><Button size="sm" variant="ghost">Login</Button></Link>
                <Link to="/register"><Button size="sm">Get Started</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Explore Available Rental Equipment</h1>
        {content}
      </main>
    </div>
  );
}
