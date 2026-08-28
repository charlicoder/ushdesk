'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Package, Search, RefreshCw, AlertCircle, ChevronDown,
  Tag, LayoutGrid, List,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api-list';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { formatCurrency } from '@/lib/helpers';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number | null;
  image: string | null;
  description: string | null;
  sku: string | null;
  is_active: boolean;
}

function normalise(raw: Record<string, unknown>): Product {
  return {
    id:          String(raw.id ?? ''),
    name:        String(raw.name ?? raw.product_name ?? ''),
    category:    String(raw.category ?? raw.product_category ?? raw.type ?? 'General'),
    price:       Number(raw.price ?? raw.base_price ?? raw.selling_price ?? 0),
    stock:       raw.stock != null ? Number(raw.stock) : null,
    image:       (raw.image ?? raw.image1 ?? raw.thumbnail ?? null) as string | null,
    description: (raw.description ?? null) as string | null,
    sku:         (raw.sku ?? raw.code ?? null) as string | null,
    is_active:   raw.is_active !== false,
  };
}

function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export default function ProductsPage() {
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('');
  const [viewMode,    setViewMode]    = useState<'grid' | 'list'>('grid');

  const { data: rawProducts, loading, error, refetch } = useApiList<Record<string, unknown>>(
    '/api/v1/products',
    [],
  );

  const products    = useMemo(() => rawProducts.map(normalise), [rawProducts]);
  const categories  = useMemo(() => products.map((p) => p.category).filter((v, i, a) => a.indexOf(v) === i).sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
      const matchCat    = !catFilter || p.category === catFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, catFilter]);

  return (
    <DashboardShell>
      <PageHeader
        title="USH Products"
        subtitle={loading ? 'Loading…' : `${products.length} products`}
      />

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <SelectFilter label="All Categories" value={catFilter} options={categories} onChange={setCatFilter} />

        {(search || catFilter) && (
          <button
            onClick={() => { setSearch(''); setCatFilter(''); }}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition"
          >
            Clear
          </button>
        )}

        {/* View toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={cn('flex h-10 w-10 items-center justify-center transition', viewMode === 'grid' ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground')}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn('flex h-10 w-10 items-center justify-center transition', viewMode === 'list' ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground')}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Count */}
      {!loading && <p className="mb-4 text-xs text-muted-foreground">Showing {filtered.length} of {products.length} products</p>}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-60 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No products found</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition hover:shadow-lg hover:-translate-y-0.5 animate-fade-in-up">
              {/* Image */}
              <div className="relative h-44 bg-muted overflow-hidden">
                {p.image ? (
                  <Image
                    src={p.image} alt={p.name} fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
                {/* Category badge */}
                <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {p.category}
                </span>
                {/* Stock badge */}
                {p.stock != null && (
                  <span className={cn(
                    'absolute top-2 right-2 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    p.stock === 0 ? 'bg-destructive text-white' : 'bg-white/90 text-foreground',
                  )}>
                    {p.stock === 0 ? 'Out of stock' : `${p.stock} in stock`}
                  </span>
                )}
              </div>

              <div className="p-4">
                <p className="font-bold text-sm truncate">{p.name}</p>
                {p.sku && <p className="text-xs text-muted-foreground mt-0.5">SKU: {p.sku}</p>}
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                )}
                <div className="mt-3 border-t border-border/50 pt-3">
                  <p className="text-lg font-bold text-primary">{formatCurrency(p.price, 'AED')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40">
                <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-left font-semibold text-xs text-muted-foreground hidden md:table-cell">SKU</th>
                <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground hidden md:table-cell">Stock</th>
                <th className="px-4 py-3 text-right font-semibold text-xs text-muted-foreground">Price</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className={cn('border-b border-border/30 transition hover:bg-muted/30', i % 2 === 0 ? '' : 'bg-muted/10')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail */}
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {p.image ? (
                          <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Tag className="h-3 w-3" /> {p.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground font-mono">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-right">
                    {p.stock != null ? (
                      <span className={cn('text-xs font-semibold', p.stock === 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                        {p.stock === 0 ? 'Out of stock' : p.stock}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(p.price, 'AED')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardShell>
  );
}
