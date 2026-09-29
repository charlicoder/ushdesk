'use client';

import { useState, useMemo } from 'react';
import {
  Percent,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Tag,
  Shield,
  Mail,
  Phone,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatAccountingDate,
  Partner,
  Tax,
  FiscalYear,
} from '@/hooks/use-accounting';

export default function TaxesAndFiscalPage() {
  const [activeTab, setActiveTab] = useState<'partners' | 'taxes' | 'fiscal'>('partners');
  const [search, setSearch]       = useState<string>('');

  // Partners list
  const {
    items: partners,
    total: partnersTotal,
    page: partnersPage,
    pages: partnersPages,
    loading: partnersLoading,
    error: partnersError,
    refetch: refetchPartners,
    setPage: setPartnersPage,
  } = useAnrList<Partner>('partners', { pageSize: 30 });

  // Taxes list
  const {
    items: taxes,
    loading: taxesLoading,
    refetch: refetchTaxes,
  } = useAnrList<Tax>('taxes', { pageSize: 50 });

  // Fiscal Years
  const {
    items: fiscalYears,
    loading: fiscalLoading,
    refetch: refetchFiscal,
  } = useAnrList<FiscalYear>('fiscal/years', { pageSize: 50 });

  const loading = activeTab === 'partners' ? partnersLoading : activeTab === 'taxes' ? taxesLoading : fiscalLoading;

  const handleRefresh = () => {
    if (activeTab === 'partners') refetchPartners();
    else if (activeTab === 'taxes') refetchTaxes();
    else refetchFiscal();
  };

  const filteredPartners = useMemo(() => {
    if (!search.trim()) return partners;
    const q = search.toLowerCase();
    return partners.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  }, [partners, search]);

  return (
    <DashboardShell>
      <PageHeader
        title="Taxes, Fiscal & Business Partners"
        subtitle="Manage tax rates, fiscal years, compliance periods, and verified business partner directories"
      />

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Business Partners',
            val: partnersTotal.toLocaleString(),
            sub: 'Vendors & customers',
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
            icon: Users,
          },
          {
            label: 'Tax Configurations',
            val: (taxes?.length ?? 0).toString(),
            sub: 'Sales & purchase taxes',
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
            icon: Percent,
          },
          {
            label: 'Fiscal Year Status',
            val: 'Open (2026)',
            sub: 'Jan 1 - Dec 31',
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
            icon: Calendar,
          },
          {
            label: 'Default Currency',
            val: 'Kuwaiti Dinar (KWD)',
            sub: '3 Decimals precision',
            color: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
            icon: Tag,
          },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={cn(
                'group rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5',
                c.color,
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/70 dark:bg-black/30">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 text-xl font-extrabold text-foreground truncate">{c.val}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar & Tabs ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {[
            { id: 'partners', label: 'Business Partners Directory', icon: Users },
            { id: 'taxes', label: 'Tax Rates & VAT', icon: Percent },
            { id: 'fiscal', label: 'Fiscal Years & Periods', icon: Calendar },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id as any); setSearch(''); }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  activeTab === t.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'partners' && (
            <div className="relative w-56 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search partner name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-border/60 bg-card pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* ── Content: Partners Directory ── */}
      {activeTab === 'partners' && (
        <div className="mt-5">
          {partnersLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl shimmer" />
              ))}
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No partners found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Try adjusting your search criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Partner Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Contact Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Country</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredPartners.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40 transition">
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{p.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {p.is_vendor && (
                            <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-600">
                              VENDOR
                            </span>
                          )}
                          {p.is_customer && (
                            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600">
                              CUSTOMER
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.email ? (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground/60" /> {p.email}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.phone ? (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-muted-foreground/60" /> {p.phone}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-muted-foreground uppercase">
                        KW
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> ACTIVE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {partnersPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {partnersPage} of {partnersPages} · {partnersTotal.toLocaleString()} total partners
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPartnersPage(Math.max(1, partnersPage - 1))}
                  disabled={partnersPage <= 1}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  onClick={() => setPartnersPage(Math.min(partnersPages, partnersPage + 1))}
                  disabled={partnersPage >= partnersPages}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Content: Taxes ── */}
      {activeTab === 'taxes' && (
        <div className="mt-5">
          {taxesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl shimmer" />
              ))}
            </div>
          ) : taxes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <Percent className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">Zero Rated (Kuwait Region)</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Kuwait standard value-added tax is currently 0%. Standard 0% sales tax applies to all service line items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {taxes.map((t) => (
                <div key={t.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{t.tax_type?.toUpperCase()}</span>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                      ACTIVE
                    </span>
                  </div>
                  <h4 className="font-extrabold text-base text-foreground mt-2">{t.name}</h4>
                  <p className="text-2xl font-black text-foreground mt-2">{t.amount}%</p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{t.amount_type} rate calculation</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Content: Fiscal ── */}
      {activeTab === 'fiscal' && (
        <div className="mt-5">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
              <div>
                <h4 className="font-extrabold text-base text-foreground">Current Fiscal Year: FY-2026</h4>
                <p className="text-xs text-muted-foreground">January 1, 2026 – December 31, 2026</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                ACTIVE & OPEN
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Start Month', val: 'January (Month 1)' },
                { label: 'Reporting Currency', val: 'KWD (3 Decimals)' },
                { label: 'Country Regulatory Code', val: 'KW (Kuwait)' },
                { label: 'Ledger Audit Status', val: 'Unclosed / Active' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{m.label}</span>
                  <p className="font-bold text-foreground mt-0.5">{m.val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
