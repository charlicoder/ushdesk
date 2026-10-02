'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Landmark,
  FileSpreadsheet,
  Wallet,
  ShieldCheck,
  Plus,
  Save,
  Loader2,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import {
  useAnrList,
  formatKwd,
  formatAccountingDate,
  getStateBadge,
  AccountingPayment,
  BankAccount,
  BankStatement,
} from '@/hooks/use-accounting';
import { authedFetch } from '@/lib/authedFetch';

export default function BankingPage() {
  const [activeTab, setActiveTab]     = useState<'payments' | 'accounts' | 'statements'>('payments');
  const [paymentType, setPaymentType] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [search, setSearch]           = useState<string>('');
  const [selectedPayment, setSelectedPayment] = useState<AccountingPayment | null>(null);
  const [showNewPayment, setShowNewPayment] = useState(false);

  // Accounting Payments
  const {
    items: payments,
    total: paymentsTotal,
    page: paymentsPage,
    pages: paymentsPages,
    loading: paymentsLoading,
    error: paymentsError,
    refetch: refetchPayments,
    setPage: setPaymentsPage,
  } = useAnrList<AccountingPayment>('payments', {
    pageSize: 30,
    params: {
      payment_type: paymentType !== 'all' ? paymentType : undefined,
    },
  });

  // Bank Accounts
  const {
    items: bankAccounts,
    loading: bankAccountsLoading,
    refetch: refetchBankAccounts,
  } = useAnrList<BankAccount>('bank/accounts', { pageSize: 50 });

  // Bank Statements
  const {
    items: statements,
    loading: statementsLoading,
    refetch: refetchStatements,
  } = useAnrList<BankStatement>('bank/statements', { pageSize: 50 });

  const loading = activeTab === 'payments' ? paymentsLoading : activeTab === 'accounts' ? bankAccountsLoading : statementsLoading;

  const handleRefresh = () => {
    if (activeTab === 'payments') refetchPayments();
    else if (activeTab === 'accounts') refetchBankAccounts();
    else refetchStatements();
  };

  const filteredPayments = useMemo(() => {
    if (!search.trim()) return payments;
    const q = search.toLowerCase();
    return payments.filter((p) =>
      p.name?.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q) ||
      p.partner_name?.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const paymentStats = useMemo(() => {
    const inbound = payments.filter((p) => p.payment_type === 'inbound').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const outbound = payments.filter((p) => p.payment_type === 'outbound').reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const net = inbound - outbound;
    return { inbound, outbound, net, count: payments.length };
  }, [payments]);

  return (
    <DashboardShell>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Banking, Cash & Payments Ledger"
          subtitle="Manage bank accounts, electronic disbursements, collections, and statement reconciliations"
        />
        {activeTab === 'payments' && (
          <button
            onClick={() => setShowNewPayment(true)}
            className="mt-1 flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-95 transition"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Payment
          </button>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Inbound Collections',
            val: formatKwd(paymentStats.inbound),
            sub: 'Cash & bank inflows',
            color: 'from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
            icon: ArrowDownLeft,
          },
          {
            label: 'Outbound Payments',
            val: formatKwd(paymentStats.outbound),
            sub: 'Vendor disbursements',
            color: 'from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400',
            icon: ArrowUpRight,
          },
          {
            label: 'Net Cash Flow',
            val: formatKwd(paymentStats.net),
            sub: paymentStats.net >= 0 ? 'Positive net flow' : 'Deficit flow',
            color: paymentStats.net >= 0
              ? 'from-sky-500/20 to-sky-500/5 text-sky-600 dark:text-sky-400'
              : 'from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400',
            icon: Wallet,
          },
          {
            label: 'Registered Records',
            val: paymentsTotal.toLocaleString(),
            sub: 'Accounting payments',
            color: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
            icon: Landmark,
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

      {/* ── Tab Switcher & Search ── */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        {/* Module Tabs */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
          {[
            { id: 'payments', label: 'Payments & Receipts', icon: CreditCard },
            { id: 'accounts', label: 'Bank Accounts', icon: Landmark },
            { id: 'statements', label: 'Bank Statements', icon: FileSpreadsheet },
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

        {/* Tab-Specific Filters & Search */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'payments' && (
            <div className="flex items-center rounded-xl border border-border/60 bg-card p-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'inbound', label: 'Inbound' },
                { id: 'outbound', label: 'Outbound' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setPaymentType(f.id as any); setPaymentsPage(1); }}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                    paymentType === f.id
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="relative w-56 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search payment ref…"
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

      {/* ── Tab Content ── */}
      {activeTab === 'payments' && (
        <>
          {loading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl shimmer" />
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No payments found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No accounting payments match the selected criteria.
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Number / Ref</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Partner / Payee</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredPayments.map((p) => {
                      const badge = getStateBadge(p.state);
                      return (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPayment(p)}
                          className="group cursor-pointer hover:bg-muted/40 transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'grid h-7 w-7 place-items-center rounded-lg text-xs font-bold',
                                p.payment_type === 'inbound' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
                              )}>
                                {p.payment_type === 'inbound' ? 'IN' : 'OUT'}
                              </div>
                              <div>
                                <p className="font-bold text-foreground group-hover:text-primary transition">{p.name}</p>
                                {p.reference && <p className="text-[10px] text-muted-foreground">{p.reference}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                              p.payment_type === 'inbound' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
                            )}>
                              {p.payment_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {p.partner_name || '—'}
                          </td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">
                            {p.payment_method || 'Bank'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatAccountingDate(p.payment_date || p.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-foreground">
                            {formatKwd(p.amount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold', badge.bg)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {paymentsPages > 1 && (
            <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Page {paymentsPage} of {paymentsPages} · {paymentsTotal.toLocaleString()} total payments
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaymentsPage(Math.max(1, paymentsPage - 1))}
                  disabled={paymentsPage <= 1}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <button
                  onClick={() => setPaymentsPage(Math.min(paymentsPages, paymentsPage + 1))}
                  disabled={paymentsPage >= paymentsPages}
                  className="flex items-center gap-1 rounded-xl border border-border/60 bg-card px-3 py-1.5 font-medium disabled:opacity-40 hover:bg-muted/60 transition"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Bank Accounts Tab ── */}
      {activeTab === 'accounts' && (
        <div className="mt-5">
          {bankAccountsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl shimmer" />
              ))}
            </div>
          ) : bankAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No bank accounts registered</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add company bank accounts to begin electronic reconciliations and wire transfers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600 font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                      ACTIVE
                    </span>
                  </div>
                  <h4 className="mt-3 font-extrabold text-base text-foreground">{acc.bank_name}</h4>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">Acc: {acc.account_number}</p>
                  {acc.iban && <p className="text-[10px] font-mono text-muted-foreground truncate">IBAN: {acc.iban}</p>}
                  <div className="mt-4 border-t border-border/40 pt-3">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Current Balance</span>
                    <p className="text-xl font-black text-foreground mt-0.5">{formatKwd(acc.current_balance)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bank Statements Tab ── */}
      {activeTab === 'statements' && (
        <div className="mt-5">
          {statementsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-2xl shimmer" />
              ))}
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-base text-foreground">No bank statements imported</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Import official bank statements to reconcile bank account records with general ledger cash accounts.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Statement Name</th>
                    <th className="px-4 py-3">Period</th>
                    <th className="px-4 py-3 text-right">Opening Balance</th>
                    <th className="px-4 py-3 text-right">Closing Balance</th>
                    <th className="px-4 py-3 text-center">Reconciliation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {statements.map((stmt) => (
                    <tr key={stmt.id} className="hover:bg-muted/40 transition">
                      <td className="px-4 py-3 font-bold text-foreground">{stmt.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatAccountingDate(stmt.date_start)} - {formatAccountingDate(stmt.date_end)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatKwd(stmt.balance_start)}</td>
                      <td className="px-4 py-3 text-right font-black text-foreground">{formatKwd(stmt.balance_end_real)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          {stmt.state?.toUpperCase() || 'POSTED'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Payment Detail Modal ── */}
      {selectedPayment && (
        <PaymentDetailModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />
      )}

      {/* ── New Payment Form Modal ── */}
      {showNewPayment && (
        <PaymentFormModal
          onClose={() => setShowNewPayment(false)}
          onCreated={() => { setShowNewPayment(false); refetchPayments(); }}
        />
      )}
    </DashboardShell>
  );
}

// ── Payment Detail Modal ────────────────────────────────────────────────────────
function PaymentDetailModal({ payment, onClose }: { payment: AccountingPayment; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const badge = getStateBadge(payment.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className={cn(
              'grid h-10 w-10 place-items-center rounded-xl text-sm font-bold',
              payment.payment_type === 'inbound' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
            )}>
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">{payment.name}</h3>
              <p className="text-xs text-muted-foreground capitalize">{payment.payment_type} Payment</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold', badge.bg)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', badge.dot)} />
              {badge.label}
            </span>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-5 text-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Amount</span>
            <p className="text-3xl font-black text-foreground mt-1">{formatKwd(payment.amount)}</p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">Method: {payment.payment_method || 'Bank Transfer'}</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/10 p-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Partner / Payee</span>
              <p className="font-semibold text-foreground mt-0.5">{payment.partner_name || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Payment Date</span>
              <p className="font-semibold text-foreground mt-0.5">{formatAccountingDate(payment.payment_date || payment.created_at)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Reference</span>
              <p className="font-semibold text-foreground mt-0.5">{payment.reference || '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] uppercase font-bold">Currency</span>
              <p className="font-semibold text-foreground mt-0.5">{payment.currency_code || 'KWD'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Register Payment Form Modal ─────────────────────────────────────────────────
function PaymentFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [paymentType, setPaymentType] = useState<'inbound' | 'outbound'>('inbound');
  const [partnerId, setPartnerId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [amount, setAmount] = useState('0');
  const [currency, setCurrency] = useState('KWD');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [pRes, jRes] = await Promise.all([
        authedFetch('/api/v1/uanr/partners/?page_size=200'),
        authedFetch('/api/v1/uanr/journals/?page_size=50'),
      ]);
      if (pRes.ok) { const d = await pRes.json(); setPartners(d?.data?.items ?? d?.items ?? []); }
      if (jRes.ok) { const d = await jRes.json(); setJournals(d?.data?.items ?? d?.items ?? []); }
    };
    load();
  }, []);

  useEffect(() => {
    const j = journals.find((j: any) => j.journal_type === 'bank');
    if (j && !journalId) setJournalId(j.id);
  }, [journals]);

  const handleSubmit = async () => {
    setFormError(null);
    if (!partnerId) { setFormError('Please select a partner.'); return; }
    if (!journalId) { setFormError('Please select a journal.'); return; }
    if (parseFloat(amount) <= 0) { setFormError('Amount must be greater than zero.'); return; }
    setSubmitting(true);
    try {
      const cRes = await authedFetch('/api/v1/uanr/companies/');
      const cj = await cRes.json().catch(() => ({}));
      const companyId = cj?.data?.items?.[0]?.id ?? cj?.items?.[0]?.id;
      const payload = {
        company_id: companyId,
        payment_type: paymentType,
        partner_id: partnerId,
        journal_id: journalId,
        amount: parseFloat(amount),
        currency_code: currency,
        payment_date: paymentDate,
        reference: reference || undefined,
        memo: memo || undefined,
      };
      const res = await authedFetch('/api/v1/uanr/payments/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-card/95 backdrop-blur px-6 py-4 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Register Payment</h3>
              <p className="text-[11px] text-muted-foreground">Inbound collection or outbound disbursement</p>
            </div>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-xl bg-muted/60 text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type Toggle */}
          <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-1 w-fit">
            {(['inbound', 'outbound'] as const).map((t) => (
              <button key={t} onClick={() => setPaymentType(t)}
                className={cn('rounded-lg px-4 py-1.5 text-xs font-bold transition capitalize', paymentType === t ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>
                {t === 'inbound' ? '↓ Receive' : '↑ Send'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Partner *</label>
              <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className={cn(inputCls, 'h-8')}>
                <option value="">— Select partner —</option>
                {partners.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Journal / Bank Account *</label>
              <select value={journalId} onChange={(e) => setJournalId(e.target.value)} className={cn(inputCls, 'h-8')}>
                <option value="">— Select journal —</option>
                {journals.map((j: any) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={cn(inputCls, 'h-8')}>
                {['KWD','USD','EUR','GBP','AED','SAR'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount *</label>
              <input type="number" min="0" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Date *</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Reference</label>
              <input type="text" placeholder="Check no., wire ref..." value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Memo</label>
              <input type="text" placeholder="Internal memo" value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
            </div>
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
              Register Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
