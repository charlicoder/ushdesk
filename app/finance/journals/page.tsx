'use client';

import { useMemo, useState } from 'react';
import { BookMarked, Plus, Search, X, Save, Loader2, Pencil, ListChecks, CheckCircle2, Layers } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAnrList, Account } from '@/hooks/use-accounting';
import {
  anrRequest,
  getCompanyId,
  inputCls,
  labelCls,
  StatGrid,
  StatusPill,
  EmptyState,
  TableSkeleton,
  ErrorBanner,
  FormModal,
  FormFooter,
  PrimaryButton,
  RefreshButton,
  Tone,
} from '@/components/finance/finance-ui';

// Mirrors ushanr `Journal` (journals endpoint)
interface JournalRow {
  id: string;
  company_id: string;
  name: string;
  code: string;
  journal_type: string;
  default_account_id?: string | null;
  suspense_account_id?: string | null;
  payment_debit_account_id?: string | null;
  payment_credit_account_id?: string | null;
  sequence_prefix?: string | null;
  currency_code?: string | null;
  is_active: boolean;
  description?: string | null;
  sequence: number;
}

const JOURNAL_TYPES = ['sale', 'purchase', 'cash', 'bank', 'general', 'misc'] as const;

const TYPE_TONE: Record<string, Tone> = {
  sale: 'emerald',
  purchase: 'purple',
  cash: 'amber',
  bank: 'blue',
  general: 'zinc',
  misc: 'zinc',
};

export default function JournalsPage() {
  const [type, setType] = useState<'all' | (typeof JOURNAL_TYPES)[number]>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<JournalRow | 'new' | null>(null);

  const { items: journals, loading, error, refetch } = useAnrList<JournalRow>('journals', {
    pageSize: 100,
    params: { journal_type: type === 'all' ? undefined : type },
  });
  const { items: accounts } = useAnrList<Account>('accounts', { pageSize: 200 });

  const accountLabel = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, `${a.code} · ${a.name}`));
    return (id?: string | null) => (id ? map.get(id) ?? '—' : '—');
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return journals;
    return journals.filter((j) => j.name?.toLowerCase().includes(q) || j.code?.toLowerCase().includes(q));
  }, [journals, search]);

  const activeCount = journals.filter((j) => j.is_active).length;
  const typeCount = new Set(journals.map((j) => j.journal_type)).size;

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Journals"
          subtitle="Configure the accounting journals used for sales, purchases, cash, bank and general postings"
        />
        <PrimaryButton onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" />
          New Journal
        </PrimaryButton>
      </div>

      <StatGrid
        items={[
          {
            label: 'Journals',
            value: journals.length.toString(),
            sub: type === 'all' ? 'All types' : `Type: ${type}`,
            icon: BookMarked,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Active',
            value: activeCount.toString(),
            sub: 'Available for postings',
            icon: CheckCircle2,
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Inactive',
            value: (journals.length - activeCount).toString(),
            sub: 'Archived journals',
            icon: ListChecks,
            color: 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Journal Types',
            value: typeCount.toString(),
            sub: 'Distinct types in use',
            icon: Layers,
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
          },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center rounded-xl border border-border/60 bg-card p-1">
          {(['all', ...JOURNAL_TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                type === t ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative w-56 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/60 bg-card pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <RefreshButton onClick={refetch} loading={loading} />
        </div>
      </div>

      <div className="mt-5">
        {error && <ErrorBanner message={error} className="mb-4" />}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon={BookMarked} title="No journals found" text="Create a journal or adjust your filters." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Journal</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Prefix</th>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Default Account</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((j) => (
                  <tr key={j.id} className="transition hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground">{j.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{j.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill label={j.journal_type} tone={TYPE_TONE[j.journal_type] ?? 'zinc'} />
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{j.sequence_prefix || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{j.currency_code || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{accountLabel(j.default_account_id)}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusPill label={j.is_active ? 'active' : 'inactive'} tone={j.is_active ? 'emerald' : 'zinc'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(j)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] font-semibold transition hover:bg-muted/60"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <JournalFormModal
          journal={editing === 'new' ? null : editing}
          accounts={accounts}
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

function JournalFormModal({
  journal,
  accounts,
  onClose,
  onSaved,
}: {
  journal: JournalRow | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!journal;
  const [name, setName] = useState(journal?.name ?? '');
  const [code, setCode] = useState(journal?.code ?? '');
  const [jType, setJType] = useState(journal?.journal_type ?? 'general');
  const [prefix, setPrefix] = useState(journal?.sequence_prefix ?? '');
  const [currency, setCurrency] = useState(journal?.currency_code ?? 'KWD');
  const [description, setDescription] = useState(journal?.description ?? '');
  const [sequence, setSequence] = useState(String(journal?.sequence ?? 10));
  const [defaultAcc, setDefaultAcc] = useState(journal?.default_account_id ?? '');
  const [suspenseAcc, setSuspenseAcc] = useState(journal?.suspense_account_id ?? '');
  const [isActive, setIsActive] = useState(journal?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setFormError(null);
    if (!name.trim()) return setFormError('Journal name is required.');
    if (!isEdit && !code.trim()) return setFormError('Journal code is required.');
    setSubmitting(true);
    try {
      const shared = {
        name: name.trim(),
        sequence_prefix: prefix.trim() || null,
        currency_code: currency.trim() || null,
        description: description.trim() || null,
        sequence: parseInt(sequence, 10) || 10,
        default_account_id: defaultAcc || null,
        suspense_account_id: suspenseAcc || null,
      };
      if (isEdit && journal) {
        await anrRequest(`journals/${journal.id}/`, 'PUT', { ...shared, is_active: isActive });
      } else {
        const companyId = await getCompanyId();
        await anrRequest('journals/', 'POST', {
          ...shared,
          company_id: companyId,
          code: code.trim().toUpperCase(),
          journal_type: jType,
        });
      }
      onSaved();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accountOptions = (
    <>
      <option value="">— None —</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} · {a.name}
        </option>
      ))}
    </>
  );

  return (
    <FormModal
      title={isEdit ? 'Edit Journal' : 'New Journal'}
      subtitle={isEdit ? `${journal?.code} · type and code are fixed` : 'Define a posting journal'}
      icon={BookMarked}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Journal Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Customer Invoices" />
          </div>
          <div>
            <label className={labelCls}>Code *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEdit}
              className={cn(inputCls, 'font-mono uppercase')}
              placeholder="e.g. INV"
              maxLength={20}
            />
          </div>
          <div>
            <label className={labelCls}>Type *</label>
            <select value={jType} onChange={(e) => setJType(e.target.value)} disabled={isEdit} className={cn(inputCls, 'capitalize')}>
              {JOURNAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Entry Number Prefix</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={cn(inputCls, 'font-mono')} placeholder="e.g. INV" />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={cn(inputCls, 'font-mono')} maxLength={3} />
          </div>
          <div>
            <label className={labelCls}>Sequence (ordering)</label>
            <input type="number" min="0" value={sequence} onChange={(e) => setSequence(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Default Account</label>
            <select value={defaultAcc} onChange={(e) => setDefaultAcc(e.target.value)} className={inputCls}>
              {accountOptions}
            </select>
          </div>
          <div>
            <label className={labelCls}>Suspense Account</label>
            <select value={suspenseAcc} onChange={(e) => setSuspenseAcc(e.target.value)} className={inputCls}>
              {accountOptions}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder="Optional" />
        </div>
        {isEdit && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
            Journal is active
          </label>
        )}
        {formError && <ErrorBanner message={formError} />}
        <FormFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={isEdit ? 'Save Changes' : 'Create Journal'}
          submitIcon={submitting ? Loader2 : Save}
        />
      </div>
    </FormModal>
  );
}
