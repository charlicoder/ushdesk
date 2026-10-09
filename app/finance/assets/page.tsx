'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Boxes,
  Plus,
  Search,
  X,
  Save,
  Wallet,
  TrendingDown,
  Coins,
  ListChecks,
  CheckCircle2,
  Loader2,
  CalendarClock,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { useAnrList, formatAccountingDate, Account } from '@/hooks/use-accounting';
import {
  anrRequest,
  getCompanyId,
  money,
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

// ── Types (mirror ushanr `Asset` / `AssetDepreciationLine`) ────────────────────

interface Asset {
  id: string;
  company_id: string;
  name: string;
  purchase_date: string;
  asset_value: number;
  book_value: number;
  salvage_value: number;
  fixed_asset_account_id?: string | null;
  depreciation_account_id?: string | null;
  expense_account_id?: string | null;
  depreciation_model?: string | null;
  method_number: number;
  method_period: number;
  asset_group?: string | null;
  status: string;
}

interface DepreciationLine {
  id: string;
  asset_id: string;
  depreciation_date: string;
  amount: number;
  remaining_value: number;
  depreciated_value: number;
  is_posted: boolean;
  journal_entry_id?: string | null;
}

type AssetDetail = Asset & { depreciation_lines: DepreciationLine[] };

const STATUS_FILTERS = ['all', 'draft', 'running', 'paused', 'close', 'cancelled'] as const;

const STATUS_TONE: Record<string, Tone> = {
  draft: 'amber',
  running: 'emerald',
  paused: 'blue',
  close: 'zinc',
  cancelled: 'rose',
};

function depreciationPct(a: Asset): number {
  const base = a.asset_value - a.salvage_value;
  if (base <= 0) return 0;
  const done = a.asset_value - a.book_value;
  return Math.max(0, Math.min(100, (done / base) * 100));
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FixedAssetsPage() {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { items: assets, loading, error, refetch } = useAnrList<Asset>('assets', {
    pageSize: 200,
    params: { status: status === 'all' ? undefined : status },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) => a.name?.toLowerCase().includes(q) || a.asset_group?.toLowerCase().includes(q),
    );
  }, [assets, search]);

  const totals = useMemo(() => {
    const cost = assets.reduce((s, a) => s + (a.asset_value || 0), 0);
    const book = assets.reduce((s, a) => s + (a.book_value || 0), 0);
    return { cost, book, accumulated: cost - book };
  }, [assets]);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Fixed Assets"
          subtitle="Track capital assets, depreciation schedules, and post depreciation into the general ledger"
        />
        <PrimaryButton onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" />
          New Asset
        </PrimaryButton>
      </div>

      <StatGrid
        items={[
          {
            label: 'Assets',
            value: assets.length.toLocaleString(),
            sub: status === 'all' ? 'All statuses' : `Status: ${status}`,
            icon: Boxes,
            color: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Acquisition Cost',
            value: `${money(totals.cost)} KWD`,
            sub: 'Gross purchase value',
            icon: Wallet,
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Accumulated Depreciation',
            value: `${money(totals.accumulated)} KWD`,
            sub: 'Posted to date',
            icon: TrendingDown,
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Net Book Value',
            value: `${money(totals.book)} KWD`,
            sub: 'Current carrying value',
            icon: Coins,
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
          },
        ]}
      />

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center rounded-xl border border-border/60 bg-card p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition',
                status === s
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'close' ? 'Closed' : s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative w-56 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search asset or group…"
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

      {/* Content */}
      <div className="mt-5">
        {error && <ErrorBanner message={error} className="mb-4" />}
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="No fixed assets found"
            text="Register a capital asset to start tracking its depreciation."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Book Value</th>
                  <th className="px-4 py-3">Depreciated</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtered.map((a) => {
                  const pct = depreciationPct(a);
                  return (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className="cursor-pointer transition hover:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-foreground">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.asset_group || '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatAccountingDate(a.purchase_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {a.depreciation_model || `${a.method_number} periods`}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{money(a.asset_value)}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {money(a.book_value)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusPill
                          label={a.status === 'close' ? 'closed' : a.status}
                          tone={STATUS_TONE[a.status] ?? 'zinc'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <NewAssetModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            refetch();
          }}
        />
      )}
      {selectedId && (
        <AssetDetailModal assetId={selectedId} onClose={() => setSelectedId(null)} onChanged={refetch} />
      )}
    </DashboardShell>
  );
}

// ── Asset detail + depreciation schedule ───────────────────────────────────────

function AssetDetailModal({
  assetId,
  onClose,
  onChanged,
}: {
  assetId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await anrRequest<AssetDetail>(`assets/${assetId}/`);
      setAsset(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const lines = useMemo(
    () =>
      [...(asset?.depreciation_lines ?? [])].sort((a, b) =>
        a.depreciation_date.localeCompare(b.depreciation_date),
      ),
    [asset],
  );
  const postedCount = lines.filter((l) => l.is_posted).length;

  const postLine = async (lineId: string) => {
    setBusyLine(lineId);
    setError(null);
    try {
      await anrRequest(`assets/lines/${lineId}/post/`, 'POST');
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyLine(null);
    }
  };

  // Backend regeneration replaces only UNPOSTED lines with a full new schedule, so it is only
  // safe while nothing has been posted yet.
  const canGenerate = postedCount === 0;
  const generate = async () => {
    if (lines.length > 0 && !window.confirm('Replace the current depreciation schedule with a freshly generated one?')) {
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      await anrRequest(`assets/${assetId}/schedule/`, 'POST');
      await load();
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <FormModal
      title={asset?.name ?? 'Fixed Asset'}
      subtitle={asset ? `${asset.asset_group || 'Ungrouped'} · ${asset.depreciation_model || ''}` : 'Loading…'}
      icon={Boxes}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <TableSkeleton rows={4} height="h-10" />
      ) : !asset ? (
        <ErrorBanner message={error ?? 'Asset not found.'} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            {[
              { label: 'Purchase Date', val: formatAccountingDate(asset.purchase_date) },
              { label: 'Cost', val: `${money(asset.asset_value)} KWD` },
              { label: 'Salvage', val: `${money(asset.salvage_value)} KWD` },
              { label: 'Book Value', val: `${money(asset.book_value)} KWD` },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{m.label}</span>
                <p className="mt-0.5 font-bold text-foreground">{m.val}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              <span>
                {postedCount} of {lines.length} lines posted ·{' '}
                {asset.method_number} × {asset.method_period} month(s)
              </span>
            </div>
            <button
              onClick={generate}
              disabled={!canGenerate || generating}
              title={
                canGenerate
                  ? 'Generate the depreciation schedule'
                  : 'Unavailable once depreciation lines have been posted'
              }
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card px-3 py-1.5 text-xs font-semibold transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {lines.length === 0 ? 'Generate Schedule' : 'Regenerate Schedule'}
            </button>
          </div>

          {error && <ErrorBanner message={error} />}

          {lines.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No depreciation schedule"
              text="Generate the schedule to see the monthly depreciation lines."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-right">Accumulated</th>
                    <th className="px-4 py-2.5 text-right">Remaining</th>
                    <th className="px-4 py-2.5 text-center">GL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {lines.map((l, i) => (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2">{formatAccountingDate(l.depreciation_date)}</td>
                      <td className="px-4 py-2 text-right font-mono">{money(l.amount)}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                        {money(l.depreciated_value)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{money(l.remaining_value)}</td>
                      <td className="px-4 py-2 text-center">
                        {l.is_posted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> POSTED
                          </span>
                        ) : (
                          <button
                            onClick={() => postLine(l.id)}
                            disabled={busyLine !== null}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
                          >
                            {busyLine === l.id && <Loader2 className="h-3 w-3 animate-spin" />}
                            Post to GL
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </FormModal>
  );
}

// ── New asset ──────────────────────────────────────────────────────────────────

function NewAssetModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { items: accounts } = useAnrList<Account>('accounts', { pageSize: 200 });

  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [cost, setCost] = useState('');
  const [salvage, setSalvage] = useState('0');
  const [periods, setPeriods] = useState('36');
  const [interval, setInterval_] = useState('1');
  const [assetStatus, setAssetStatus] = useState('running');
  const [fixedAcc, setFixedAcc] = useState('');
  const [deprAcc, setDeprAcc] = useState('');
  const [expAcc, setExpAcc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const accountsOfType = (type: string) => {
    const typed = accounts.filter((a) => a.account_type === type);
    return typed.length > 0 ? typed : accounts;
  };

  const handleSubmit = async () => {
    setFormError(null);
    const costNum = parseFloat(cost);
    const salvageNum = parseFloat(salvage) || 0;
    const periodsNum = parseInt(periods, 10);
    const intervalNum = parseInt(interval, 10);
    if (!name.trim()) return setFormError('Asset name is required.');
    if (!purchaseDate) return setFormError('Purchase date is required.');
    if (!(costNum > 0)) return setFormError('Acquisition cost must be greater than zero.');
    if (salvageNum < 0 || salvageNum >= costNum) return setFormError('Salvage value must be between 0 and the cost.');
    if (!(periodsNum > 0) || !(intervalNum > 0)) return setFormError('Periods and interval must be positive numbers.');

    setSubmitting(true);
    try {
      const companyId = await getCompanyId();
      await anrRequest('assets/', 'POST', {
        company_id: companyId,
        name: name.trim(),
        purchase_date: purchaseDate,
        asset_value: costNum,
        salvage_value: salvageNum,
        fixed_asset_account_id: fixedAcc || undefined,
        depreciation_account_id: deprAcc || undefined,
        expense_account_id: expAcc || undefined,
        depreciation_model: `${periodsNum * intervalNum} Month Linear`,
        method_number: periodsNum,
        method_period: intervalNum,
        asset_group: group.trim() || undefined,
        status: assetStatus,
      });
      onCreated();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accountSelect = (value: string, onChange: (v: string) => void, type: string) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">— Select account —</option>
      {accountsOfType(type).map((a) => (
        <option key={a.id} value={a.id}>
          {a.code} · {a.name}
        </option>
      ))}
    </select>
  );

  return (
    <FormModal
      title="New Fixed Asset"
      subtitle="A linear depreciation schedule is generated automatically"
      icon={Boxes}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Asset Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reception Furniture" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Asset Group</label>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Furniture" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Purchase Date *</label>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={assetStatus} onChange={(e) => setAssetStatus(e.target.value)} className={inputCls}>
              <option value="running">Running</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Acquisition Cost (KWD) *</label>
            <input type="number" min="0" step="0.001" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Salvage Value (KWD)</label>
            <input type="number" min="0" step="0.001" value={salvage} onChange={(e) => setSalvage(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Number of Depreciations *</label>
            <input type="number" min="1" step="1" value={periods} onChange={(e) => setPeriods(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Interval (months) *</label>
            <input type="number" min="1" step="1" value={interval} onChange={(e) => setInterval_(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/40 bg-muted/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Accounting (required to post depreciation to the GL)
          </p>
          <div>
            <label className={labelCls}>Fixed Asset Account</label>
            {accountSelect(fixedAcc, setFixedAcc, 'asset')}
          </div>
          <div>
            <label className={labelCls}>Accumulated Depreciation Account</label>
            {accountSelect(deprAcc, setDeprAcc, 'asset')}
          </div>
          <div>
            <label className={labelCls}>Depreciation Expense Account</label>
            {accountSelect(expAcc, setExpAcc, 'expense')}
          </div>
        </div>

        {formError && <ErrorBanner message={formError} />}
        <FormFooter
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel="Create Asset"
          submitIcon={submitting ? Loader2 : Save}
        />
      </div>
    </FormModal>
  );
}
