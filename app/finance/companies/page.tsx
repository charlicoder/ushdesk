'use client';

import { useState } from 'react';
import { Briefcase, Pencil, Save, Loader2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { useAnrList } from '@/hooks/use-accounting';
import {
  anrRequest,
  inputCls,
  labelCls,
  StatusPill,
  EmptyState,
  TableSkeleton,
  ErrorBanner,
  FormModal,
  FormFooter,
  RefreshButton,
} from '@/components/finance/finance-ui';

interface Company {
  id: string;
  name: string;
  legal_name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  currency_code?: string | null;
  country_code?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  fiscal_year_start_month?: number | null;
  decimal_places?: number | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CompaniesPage() {
  const { items, loading, error, refetch } = useAnrList<Company>('companies', { pageSize: 100 });
  const [editing, setEditing] = useState<Company | null>(null);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Companies" subtitle="Legal entities configured in the accounting service" />
        <div className="mt-1">
          <RefreshButton onClick={refetch} loading={loading} />
        </div>
      </div>

      {error && <ErrorBanner message={String(error)} className="mt-4" />}

      <div className="mt-5">
        {loading && items.length === 0 ? (
          <TableSkeleton rows={2} height="h-40" />
        ) : items.length === 0 ? (
          <EmptyState icon={Briefcase} title="No companies" text="No company is configured in the accounting service." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Briefcase className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{c.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{c.legal_name || c.trade_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill label={c.is_active ? 'Active' : 'Inactive'} tone={c.is_active ? 'emerald' : 'zinc'} />
                    <button
                      onClick={() => setEditing(c)}
                      className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground transition hover:text-foreground"
                      aria-label="Edit company"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Info label="Tax ID" value={c.tax_id} />
                  <Info label="Currency" value={c.currency_code} />
                  <Info label="Country" value={c.country_code} />
                  <Info label="Fiscal year starts" value={c.fiscal_year_start_month ? MONTHS[c.fiscal_year_start_month - 1] : null} />
                  <Info label="Decimal places" value={c.decimal_places?.toString()} />
                </dl>

                <div className="mt-4 space-y-1.5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  {c.address && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{c.address}</p>}
                  {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                  {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                  {c.website && <p className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" />{c.website}</p>}
                  {!c.address && !c.phone && !c.email && !c.website && <p>No contact details</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditCompanyModal
          company={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}
    </DashboardShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value || '—'}</dd>
    </div>
  );
}

function EditCompanyModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: company.name ?? '',
    legal_name: company.legal_name ?? '',
    trade_name: company.trade_name ?? '',
    address: company.address ?? '',
    phone: company.phone ?? '',
    email: company.email ?? '',
    website: company.website ?? '',
    currency_code: company.currency_code ?? '',
    fiscal_year_start_month: company.fiscal_year_start_month ?? 1,
    decimal_places: company.decimal_places ?? 3,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof f, v: string | number) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    setErr('');
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(),
        legal_name: f.legal_name.trim() || null,
        trade_name: f.trade_name.trim() || null,
        address: f.address.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        website: f.website.trim() || null,
        fiscal_year_start_month: Number(f.fiscal_year_start_month),
        decimal_places: Number(f.decimal_places),
      };
      if (f.currency_code.trim()) body.currency_code = f.currency_code.trim().toUpperCase();
      await anrRequest(`companies/${company.id}/`, 'PUT', body);
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal title="Edit Company" subtitle={company.name} icon={Briefcase} onClose={onClose} maxWidth="max-w-xl">
      <div className="space-y-4">
        {err && <ErrorBanner message={err} />}
        <div>
          <label className={labelCls}>Name *</label>
          <input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Legal Name</label>
            <input className={inputCls} value={f.legal_name} onChange={(e) => set('legal_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Trade Name</label>
            <input className={inputCls} value={f.trade_name} onChange={(e) => set('trade_name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={f.website} onChange={(e) => set('website', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input className={inputCls} maxLength={3} value={f.currency_code} onChange={(e) => set('currency_code', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Fiscal Year Starts</label>
            <select className={inputCls} value={f.fiscal_year_start_month} onChange={(e) => set('fiscal_year_start_month', Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Decimal Places</label>
            <input type="number" min={0} max={6} className={inputCls} value={f.decimal_places} onChange={(e) => set('decimal_places', e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <textarea className={`${inputCls} h-16 py-2`} value={f.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <FormFooter onCancel={onClose} onSubmit={submit} submitting={saving} submitLabel="Save Changes" submitIcon={saving ? Loader2 : Save} disabled={!f.name.trim()} />
      </div>
    </FormModal>
  );
}
