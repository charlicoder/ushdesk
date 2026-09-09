'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Phone, Mail, Calendar, RefreshCw, AlertCircle, Search,
  LayoutGrid, List, CheckCircle2, XCircle, ChevronDown,
  MessageCircle, ShieldCheck, User, Send, X, CheckCheck,
  MessageSquare, Loader2,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api-list';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { useI18n } from '@/hooks/use-i18n';
import { cn } from '@/lib/utils';


// ── Types ──────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  dob: string | null;
  avatar: string | null;
  account_status: string;
  is_mobile_verified: boolean;
  is_whatsapp_verified: boolean;
  is_email_verified: boolean;
  is_loyalty_enrolled: boolean;
  notification_channel: string | null;
}

type MessageChannel = 'sms' | 'whatsapp' | 'email';

// ── Normalise ──────────────────────────────────────────────────────────────────
function normalise(raw: Record<string, unknown>): Customer {
  const first = String(raw.first_name ?? '');
  const last  = String(raw.last_name  ?? '');
  return {
    id:                   String(raw.id ?? ''),
    name:                 [first, last].filter(Boolean).join(' ') || String(raw.name ?? 'Unknown'),
    phone:                (raw.phone_number ?? raw.phone ?? null) as string | null,
    email:                (raw.email ?? null) as string | null,
    gender:               (raw.gender ?? null) as string | null,
    dob:                  (raw.dob ?? null) as string | null,
    avatar:               (raw.avatar ?? null) as string | null,
    account_status:       String(raw.account_status ?? 'active').toLowerCase(),
    is_mobile_verified:   raw.is_mobile_verified === true,
    is_whatsapp_verified: raw.is_whatsapp_verified === true,
    is_email_verified:    raw.is_email_verified === true,
    is_loyalty_enrolled:  raw.is_loyalty_enrolled === true,
    notification_channel: (raw.notification_channel ?? null) as string | null,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function formatDob(dob: string | null) {
  if (!dob) return null;
  return new Date(dob).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function VerifiedBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
      ok
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : 'bg-muted text-muted-foreground',
    )}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}

function Avatar({ customer, size = 'md' }: { customer: Customer; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-sm' : size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-lg';
  const rounded = size === 'sm' ? 'rounded-xl' : 'rounded-2xl';
  if (customer.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={customer.avatar} alt={customer.name} className={cn(dim, rounded, 'object-cover shrink-0')} />;
  }
  const genderGradient = customer.gender === 'female'
    ? 'from-rose-400 to-pink-500'
    : customer.gender === 'male'
      ? 'from-sky-400 to-blue-500'
      : 'from-primary to-accent';
  return (
    <div className={cn('grid shrink-0 place-items-center bg-gradient-to-br font-bold text-white', dim, rounded, genderGradient)}>
      {initials(customer.name)}
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-xl border border-border bg-card pl-3 pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer">
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function ToggleFilter({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(
      'flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition',
      active
        ? 'border-primary bg-primary text-white shadow-sm'
        : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary',
    )}>
      {icon}{label}
    </button>
  );
}

// ── Send Message Modal ─────────────────────────────────────────────────────────
function SendMessageModal({
  selectedCount,
  onClose,
  onSend,
}: {
  selectedCount: number;
  onClose: () => void;
  onSend: (channel: MessageChannel, message: string) => Promise<void>;
}) {
  const [channel, setChannel] = useState<MessageChannel>('whatsapp');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const channelConfig: Record<MessageChannel, { label: string; icon: React.ReactNode; color: string; placeholder: string }> = {
    whatsapp: {
      label: 'WhatsApp',
      icon: <MessageCircle className="h-4 w-4" />,
      color: 'border-green-500 bg-green-500',
      placeholder: 'Type your WhatsApp message…',
    },
    sms: {
      label: 'SMS',
      icon: <MessageSquare className="h-4 w-4" />,
      color: 'border-blue-500 bg-blue-500',
      placeholder: 'Type your SMS message…',
    },
    email: {
      label: 'Email',
      icon: <Mail className="h-4 w-4" />,
      color: 'border-purple-500 bg-purple-500',
      placeholder: 'Type your email message…',
    },
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    await onSend(channel, message.trim());
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="font-bold text-base">Send Message</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sending to <span className="font-semibold text-primary">{selectedCount}</span> customer{selectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-muted transition text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Channel tabs */}
        <div className="px-6 pt-5">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Channel</p>
          <div className="flex gap-2">
            {(Object.keys(channelConfig) as MessageChannel[]).map((ch) => {
              const cfg = channelConfig[ch];
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition',
                    channel === ch
                      ? `${cfg.color} text-white shadow-sm border-transparent`
                      : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground',
                  )}
                >
                  {cfg.icon}
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message input */}
        <div className="px-6 pt-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={channelConfig[channel].placeholder}
            className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">{message.length} chars</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl px-6 text-sm font-semibold text-white transition',
              !message.trim() || sending
                ? 'bg-primary/40 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 shadow-sm',
            )}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              <><Send className="h-4 w-4" /> Send {channelConfig[channel].label}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Success Toast ──────────────────────────────────────────────────────────────
function SuccessToast({
  channel,
  count,
  onClose,
}: {
  channel: MessageChannel;
  count: number;
  onClose: () => void;
}) {
  const labels: Record<MessageChannel, string> = {
    whatsapp: 'WhatsApp',
    sms: 'SMS',
    email: 'Email',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/30 px-5 py-4 shadow-xl animate-fade-in-up">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
        <CheckCheck className="h-5 w-5" />
      </div>
      <div>
        <p className="font-bold text-sm text-emerald-800 dark:text-emerald-200">Message Sent!</p>
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          {labels[channel]} sent to {count} customer{count !== 1 ? 's' : ''} successfully.
        </p>
      </div>
      <button
        onClick={onClose}
        className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-800 transition text-emerald-600"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { t } = useI18n();

  const [search,          setSearch]          = useState('');
  const [genderFilter,    setGenderFilter]    = useState('');
  const [whatsappOnly,    setWhatsappOnly]    = useState(false);
  const [emailOnly,       setEmailOnly]       = useState(false);
  const [viewMode,        setViewMode]        = useState<'grid' | 'list'>('grid');

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [showMsgModal,    setShowMsgModal]    = useState(false);
  const [successInfo,     setSuccessInfo]     = useState<{ channel: MessageChannel; count: number } | null>(null);

  const { data: rawCustomers, loading, error, refetch } = useApiList<Record<string, unknown>>(
    '/api/v1/customers',
  );

  const customers = useMemo(() => rawCustomers.map(normalise), [rawCustomers]);

  const genderOptions = useMemo(
    () => customers.map((c) => c.gender ?? '').filter((v, i, a) => v && a.indexOf(v) === i).sort(),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      const matchSearch   = !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
      const matchGender   = !genderFilter || c.gender === genderFilter;
      const matchWhatsapp = !whatsappOnly || c.is_whatsapp_verified;
      const matchEmail    = !emailOnly    || c.is_email_verified;
      return matchSearch && matchGender && matchWhatsapp && matchEmail;
    });
  }, [customers, search, genderFilter, whatsappOnly, emailOnly]);

  const hasFilter = search || genderFilter || whatsappOnly || emailOnly;
  const clearAll  = () => { setSearch(''); setGenderFilter(''); setWhatsappOnly(false); setEmailOnly(false); };

  // Selection helpers
  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.add(c.id));
        return next;
      });
    }
  }, [allFilteredSelected, filtered]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Send message handler (replace with real API call later)
  const handleSend = useCallback(async (channel: MessageChannel, _message: string): Promise<void> => {
    // TODO: replace with real API call
    // await fetch('/api/v1/messages/bulk', { method: 'POST', body: JSON.stringify({ ids: [...selectedIds], channel, message: _message }) });
    await new Promise((r) => setTimeout(r, 1200)); // simulate network
    const count = selectedIds.size;
    setShowMsgModal(false);
    clearSelection();
    setSuccessInfo({ channel, count });
    setTimeout(() => setSuccessInfo(null), 5000);
  }, [selectedIds, clearSelection]);

  return (
    <DashboardShell>
      <PageHeader
        title={t('navCustomers')}
        subtitle={loading ? 'Loading…' : `${customers.length} ${t('navCustomers').toLowerCase()}`}
      />

      {/* Error */}
      {error && !loading && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error} — showing demo data</span>
          <button onClick={refetch} className="flex items-center gap-1 font-semibold hover:underline">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email…"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>

        {/* Gender */}
        <SelectFilter label="All Genders" value={genderFilter} options={genderOptions} onChange={setGenderFilter} />

        {/* WhatsApp verified */}
        <ToggleFilter
          label="WhatsApp"
          icon={<MessageCircle className="h-4 w-4" />}
          active={whatsappOnly}
          onClick={() => setWhatsappOnly((v) => !v)}
        />

        {/* Email verified */}
        <ToggleFilter
          label="Email Verified"
          icon={<Mail className="h-4 w-4" />}
          active={emailOnly}
          onClick={() => setEmailOnly((v) => !v)}
        />

        {hasFilter && (
          <button onClick={clearAll}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition">
            Clear
          </button>
        )}

        <div className="flex-1" />
        {!loading && <span className="text-xs text-muted-foreground">{filtered.length} of {customers.length}</span>}

        {/* View toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['grid', 'list'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn('flex h-10 w-10 items-center justify-center transition',
                viewMode === m ? 'bg-primary text-white' : 'bg-card hover:bg-muted text-muted-foreground')}
              aria-label={m === 'grid' ? 'Grid view' : 'List view'}>
              {m === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Selection action bar ── */}
      {someSelected && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-3 animate-fade-in-up">
          <span className="text-sm font-semibold text-primary">
            {selectedIds.size} customer{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={() => setShowMsgModal(true)}
            className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition"
          >
            <Send className="h-3.5 w-3.5" /> Send Message
          </button>
          <button
            onClick={clearSelection}
            className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-3.5 w-3.5" /> Deselect All
          </button>
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-2xl shimmer" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <User className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No customers found</p>
        </div>
      )}

      {/* ── GRID VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isSelected = selectedIds.has(c.id);
            return (
              <div
                key={c.id}
                onClick={() => toggleSelect(c.id)}
                className={cn(
                  'group relative rounded-2xl border bg-card p-4 transition cursor-pointer animate-fade-in-up',
                  isSelected
                    ? 'border-primary/60 bg-primary/5 shadow-md ring-2 ring-primary/20'
                    : 'border-border/50 hover:border-primary/40 hover:shadow-md',
                )}
              >
                {/* Selection checkbox */}
                <div className={cn(
                  'absolute top-3 right-3 h-5 w-5 rounded-md border-2 transition flex items-center justify-center shrink-0',
                  isSelected
                    ? 'border-primary bg-primary'
                    : 'border-border/60 bg-card group-hover:border-primary/50',
                )}>
                  {isSelected && <CheckCheck className="h-3 w-3 text-white" />}
                </div>

                {/* Header row */}
                <div className="flex items-start gap-3 pr-7">
                  <Avatar customer={c} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.gender ?? '—'}</p>
                    {c.dob && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> {formatDob(c.dob)}
                      </p>
                    )}
                  </div>
                  {/* Account status */}
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize',
                    c.account_status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground',
                  )}>
                    {c.account_status}
                  </span>
                </div>

                {/* Contact */}
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {c.phone && (
                    <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {c.phone}</p>
                  )}
                  {c.email && (
                    <p className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" /> {c.email}</p>
                  )}
                </div>

                {/* Verification badges */}
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
                  <VerifiedBadge ok={c.is_whatsapp_verified} label="WhatsApp" />
                  <VerifiedBadge ok={c.is_email_verified}    label="Email" />
                  <VerifiedBadge ok={c.is_mobile_verified}   label="Mobile" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/40">
                {/* Select-all checkbox */}
                <th className="px-4 py-3 w-10">
                  <div
                    onClick={toggleSelectAll}
                    className={cn(
                      'mx-auto h-5 w-5 rounded-md border-2 transition flex items-center justify-center cursor-pointer',
                      allFilteredSelected
                        ? 'border-primary bg-primary'
                        : someSelected
                          ? 'border-primary bg-primary/20'
                          : 'border-border/60 bg-card hover:border-primary/50',
                    )}
                  >
                    {allFilteredSelected && <CheckCheck className="h-3 w-3 text-white" />}
                    {!allFilteredSelected && someSelected && (
                      <span className="block h-0.5 w-3 bg-primary rounded-full" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">DOB</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Verified</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    onClick={() => toggleSelect(c.id)}
                    className={cn(
                      'border-b border-border/30 transition cursor-pointer',
                      isSelected
                        ? 'bg-primary/5 border-primary/20'
                        : i % 2 !== 0
                          ? 'bg-muted/10 hover:bg-muted/30'
                          : 'hover:bg-muted/30',
                    )}
                  >
                    {/* Row checkbox */}
                    <td className="px-4 py-3 w-10">
                      <div className={cn(
                        'mx-auto h-5 w-5 rounded-md border-2 transition flex items-center justify-center',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-border/60 bg-card',
                      )}>
                        {isSelected && <CheckCheck className="h-3 w-3 text-white" />}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar customer={c} size="sm" />
                        <p className="font-semibold text-sm">{c.name}</p>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {c.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                        {c.email && <p className="flex items-center gap-1 max-w-[180px] truncate"><Mail className="h-3 w-3 shrink-0" /> {c.email}</p>}
                      </div>
                    </td>

                    {/* Gender */}
                    <td className="px-4 py-3 hidden md:table-cell text-xs capitalize text-muted-foreground">
                      {c.gender ?? '—'}
                    </td>

                    {/* DOB */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.dob
                        ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar className="h-3 w-3" /> {formatDob(c.dob)}</span>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </td>

                    {/* Verified badges */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex justify-center flex-wrap gap-1">
                        {c.is_whatsapp_verified && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 text-[11px] font-semibold">
                            <MessageCircle className="h-3 w-3" /> WA
                          </span>
                        )}
                        {c.is_email_verified && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 text-[11px] font-semibold">
                            <ShieldCheck className="h-3 w-3" /> Email
                          </span>
                        )}
                        {c.is_mobile_verified && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-1.5 py-0.5 text-[11px] font-semibold">
                            <Phone className="h-3 w-3" /> Mobile
                          </span>
                        )}
                        {!c.is_whatsapp_verified && !c.is_email_verified && !c.is_mobile_verified && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                        c.account_status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', c.account_status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground')} />
                        {c.account_status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Send Message Modal */}
      {showMsgModal && (
        <SendMessageModal
          selectedCount={selectedIds.size}
          onClose={() => setShowMsgModal(false)}
          onSend={handleSend}
        />
      )}

      {/* Success Toast */}
      {successInfo && (
        <SuccessToast
          channel={successInfo.channel}
          count={successInfo.count}
          onClose={() => setSuccessInfo(null)}
        />
      )}
    </DashboardShell>
  );
}
