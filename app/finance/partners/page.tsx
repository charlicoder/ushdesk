'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Handshake,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Copy,
  Mail,
  Phone,
  Tag,
  Shield,
  CreditCard,
  ArrowUpRight,
  ExternalLink,
  Globe,
  Clock,
  Plus,
  Save,
  Loader2,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatAccountingDate,
  Partner,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

function partnerInitials(name: string) {
  if (!name) return '?';
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (clean.slice(0, 2) || '?').toUpperCase();
}

function partnerGradient(type: string, isVendor: boolean, isCustomer: boolean) {
  if (isVendor && isCustomer) return 'from-purple-600 to-blue-600';
  if (isVendor) return 'from-purple-600 to-indigo-600';
  if (isCustomer) return 'from-blue-600 to-sky-600';
  return 'from-slate-600 to-zinc-600';
}

export default function PartnersPage() {
  const [filterType, setFilterType] = useState<'all' | 'vendor' | 'customer' | 'company'>('all');
  const [search, setSearch]         = useState<string>('');
  const [view, setView]             = useState<'list' | 'grid'>('list');
  const [selected, setSelected]     = useState<Partner | null>(null);
  const [showNewPartner, setShowNewPartner] = useState(false);

  const {
    items: rawPartners,
    total,
    page,
    pages,
    loading,
    error,
    refetch,
    setPage,
  } = useAnrList<Partner>('partners', {
    pageSize: 30,
    params: {
      is_vendor: filterType === 'vendor' ? true : undefined,
      is_customer: filterType === 'customer' ? true : undefined,
    },
  });

  // Client-side filtering for companies and search
  const filtered = useMemo(() => {
    let result = rawPartners;
    if (filterType === 'company') {
      result = result.filter((p) => p.is_company);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rawPartners, filterType, search]);

  const stats = useMemo(() => {
    const vendors = rawPartners.filter((p) => p.is_vendor).length;
    const customers = rawPartners.filter((p) => p.is_customer).length;
    const companies = rawPartners.filter((p) => p.is_company).length;
    return { vendors, customers, companies, count: rawPartners.length };
  }, [rawPartners]);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Business Partners"
          subtitle="Manage verified vendor records, customer accounts, suppliers, and commercial partners"
        />
        <button
          onClick={() => setShowNewPartner(true)}
          className="mt-1 flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-95 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          New Partner
        </button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Total Partners',
            val: total.toLocaleString(),
            sub: 'Active directory records',
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
            icon: Handshake,
          },
          {
            label: 'Vendors & Suppliers',
            val: stats.vendors.toLocaleString(),
            sub: 'Payable counterparties',
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
            icon: Building2,
          },
          {
            label: 'Customers & Clients',
            val: stats.customers.toLocaleString(),
            sub: 'Receivable counterparties',
            color: 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400',
            icon: Users,
          },
          {
            label: 'Corporate Entities',
            val: stats.companies.toLocaleString(),
            sub: 'Registered companies',
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
            icon: Shield,
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
              <p className="mt-2 text-2xl font-black text-foreground truncate">{c.val}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar & Filters ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {[
            { id: 'all', label: 'All Partners' },
            { id: 'vendor', label: 'Vendors' },
            { id: 'customer', label: 'Customers' },
            { id: 'company', label: 'Companies' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setFilterType(t.id as any); setPage(1); }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                filterType === t.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search partner name, email, phone…"
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

          {/* List/Grid View */}
          <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
            <button
              onClick={() => setView('list')}
              className={cn('p-1.5 rounded-lg transition', view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView('grid')}
              className={cn('p-1.5 rounded-lg transition', view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card text-muted-foreground hover:text-foreground transition"
            title="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin text-primary')} />
          </button>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Main Content ── */}
      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
          <Handshake className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="font-bold text-base text-foreground">No partners found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Try adjusting your search query or selecting a different partner category.
          </p>
        </div>
      ) : view === 'list' ? (
        /* List View */
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Partner Entity</th>
                  <th className="px-4 py-3">Type & Role</th>
                  <th className="px-4 py-3">Contact Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((p) => {
                  const gradient = partnerGradient(p.partner_type || '', p.is_vendor, p.is_customer);
                  const inits = partnerInitials(p.name);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      className="group cursor-pointer hover:bg-muted/40 transition"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white font-bold text-xs shadow-xs', gradient)}>
                            {inits}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-bold text-foreground truncate group-hover:text-primary transition">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">ID: {p.id.slice(0, 8)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {p.is_vendor && (
                            <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                              VENDOR
                            </span>
                          )}
                          {p.is_customer && (
                            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                              CUSTOMER
                            </span>
                          )}
                          {p.is_company && (
                            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              COMPANY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.email ? (
                          <span className="flex items-center gap-1 hover:text-foreground">
                            <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="truncate max-w-[180px]">{p.email}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono">
                        {p.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span>{p.phone}</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          {p.country_code || 'KW'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> ACTIVE
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] font-bold text-primary group-hover:underline inline-flex items-center gap-0.5">
                          View Details <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const gradient = partnerGradient(p.partner_type || '', p.is_vendor, p.is_customer);
            const inits = partnerInitials(p.name);
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5 cursor-pointer shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white font-black text-sm shadow-xs', gradient)}>
                        {inits}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-sm text-foreground truncate group-hover:text-primary transition">{p.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-mono">#{p.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                      ACTIVE
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
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
                    {p.is_company && (
                      <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600">
                        COMPANY
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 border-t border-border/40 pt-3 text-xs">
                    {p.email && (
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </div>
                    )}
                    {p.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground font-mono">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{p.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span>Kuwait ({p.country_code || 'KW'})</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-border/40 pt-3 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Terms: {p.payment_terms_days ?? 0} days</span>
                  <span className="text-primary font-bold inline-flex items-center gap-0.5 group-hover:underline">
                    View Dossier <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {page} of {pages} · {total.toLocaleString()} total partners
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page >= pages}
              className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Partner Details Modal ── */}
      {selected && <PartnerModal partner={selected} onClose={() => setSelected(null)} />}

      {/* ── New Partner Form Modal ── */}
      {showNewPartner && (
        <PartnerFormModal
          onClose={() => setShowNewPartner(false)}
          onCreated={() => { setShowNewPartner(false); refetch(); }}
        />
      )}
    </DashboardShell>
  );
}

// ── Partner Modal ───────────────────────────────────────────────────────────────
function PartnerModal({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyId = () => {
    navigator.clipboard?.writeText(partner.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const gradient = partnerGradient(partner.partner_type || '', partner.is_vendor, partner.is_customer);
  const inits = partnerInitials(partner.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className={cn('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-white font-black text-base shadow-xs', gradient)}>
              {inits}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-foreground">{partner.name}</h3>
                <button
                  onClick={copyId}
                  className="text-muted-foreground hover:text-foreground transition"
                  title="Copy Partner ID"
                >
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">ID: {partner.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Roles & Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {partner.is_vendor && (
              <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400">
                VENDOR / SUPPLIER
              </span>
            )}
            {partner.is_customer && (
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                CUSTOMER / CLIENT
              </span>
            )}
            {partner.is_company && (
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                CORPORATE ENTITY
              </span>
            )}
            <span className="rounded-full bg-muted border border-border/40 px-3 py-1 text-xs font-semibold text-muted-foreground ml-auto">
              Status: Active
            </span>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Contact Channels
            </h4>
            <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email Address</span>
                <span className="font-semibold text-foreground">
                  {partner.email ? (
                    <a href={`mailto:${partner.email}`} className="text-primary hover:underline">
                      {partner.email}
                    </a>
                  ) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Phone Number</span>
                <span className="font-mono font-semibold text-foreground">
                  {partner.phone ? (
                    <a href={`tel:${partner.phone}`} className="text-primary hover:underline">
                      {partner.phone}
                    </a>
                  ) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Country Jurisdiction</span>
                <span className="font-bold text-foreground">Kuwait (KW)</span>
              </div>
            </div>
          </div>

          {/* Commercial & Accounting */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              Commercial & Fiscal Terms
            </h4>
            <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Default Currency</span>
                <p className="font-bold text-foreground mt-0.5">Kuwaiti Dinar (KWD)</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Payment Terms</span>
                <p className="font-bold text-foreground mt-0.5">Immediate (0 Days)</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Tax / VAT ID</span>
                <p className="font-semibold text-foreground mt-0.5">{partner.vat_id || 'Not Registered'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">Registration Date</span>
                <p className="font-semibold text-foreground mt-0.5">{formatAccountingDate(partner.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── New Partner Form Modal ─────────────────────────────────────────────────────
function PartnerFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [partnerType, setPartnerType] = useState('customer');
  const [isCustomer, setIsCustomer] = useState(true);
  const [isVendor, setIsVendor] = useState(false);
  const [isCompany, setIsCompany] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('KW');
  const [taxId, setTaxId] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('0');
  const [currency, setCurrency] = useState('KWD');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    if (!name.trim()) { setFormError('Partner name is required.'); return; }
    setSubmitting(true);
    try {
      const cRes = await authedFetch('/api/v1/uanr/companies/');
      const cj = await cRes.json().catch(() => ({}));
      const companyId = cj?.data?.items?.[0]?.id ?? cj?.items?.[0]?.id;
      const payload = {
        company_id: companyId,
        name: name.trim(),
        partner_type: partnerType,
        is_customer: isCustomer,
        is_vendor: isVendor,
        is_company: isCompany,
        email: email || undefined,
        phone: phone || undefined,
        mobile: mobile || undefined,
        street: street || undefined,
        city: city || undefined,
        country_code: countryCode || undefined,
        tax_id: taxId || undefined,
        payment_terms_days: parseInt(paymentTermsDays) || 0,
        currency_code: currency,
        notes: notes || undefined,
      };
      const res = await authedFetch('/api/v1/uanr/partners/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.detail ?? `HTTP ${res.status}`);
      onCreated();
    } catch (e: any) { setFormError(e.message); } finally { setSubmitting(false); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const inputCls = 'h-8 w-full rounded-lg border border-border/60 bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Handshake className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">New Business Partner</h3>
              <p className="text-[11px] text-muted-foreground">Customer, vendor, or supplier</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type selector */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-1 w-fit">
            {(['customer', 'vendor', 'both'] as const).map((t) => (
              <button key={t} onClick={() => { setPartnerType(t === 'both' ? 'customer' : t); setIsCustomer(t !== 'vendor'); setIsVendor(t !== 'customer'); }}
                className={cn('rounded-lg px-3 py-1.5 text-xs font-bold transition capitalize', (t === 'customer' && isCustomer && !isVendor) || (t === 'vendor' && isVendor && !isCustomer) || (t === 'both' && isCustomer && isVendor) ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'both' ? 'Customer & Vendor' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Partner / Company Name *</label>
              <input type="text" placeholder="Full legal name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" placeholder="contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" placeholder="+965 XXXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Mobile</label>
              <input type="tel" placeholder="+965 XXXX XXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tax / VAT ID</label>
              <input type="text" placeholder="Tax registration number" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Street / Address</label>
              <input type="text" placeholder="Street address" value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input type="text" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Country Code</label>
              <input type="text" placeholder="e.g. KW, US, GB" maxLength={3} value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Terms (days)</label>
              <input type="number" min="0" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={cn(inputCls, 'h-8')}>
                {['KWD','USD','EUR','GBP','AED','SAR'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isCompany} onChange={(e) => setIsCompany(e.target.checked)} className="rounded" />
              <span>Is a Company (not individual)</span>
            </label>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} placeholder="Internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {formError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 pt-4">
            <button onClick={onClose} className="rounded-xl border border-border/60 bg-muted/40 px-4 py-2 text-xs font-semibold hover:bg-muted transition">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-60 transition">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Create Partner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
