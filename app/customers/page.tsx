'use client';

import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Phone, Mail, Calendar, RefreshCw, AlertCircle, Search,
  LayoutGrid, List, CheckCircle2, XCircle, ChevronDown,
  MessageCircle, ShieldCheck, User, Send, X, CheckCheck,
  MessageSquare, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Check, Eye, Copy, Award, Gift, DollarSign, TrendingUp, Clock,
  Sparkles, ShoppingBag, Receipt, Star, Tag, Activity, BarChart3,
  MapPin, UserCheck, Heart,
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
  first_name?: string;
  last_name?: string;
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
  created_at: string | null;
  raw?: Record<string, unknown>;
}

type MessageChannel = 'sms' | 'whatsapp' | 'email';
type SignupDateFilter = '' | 'today' | 'last_week' | 'last_month';

// ── Normalise ──────────────────────────────────────────────────────────────────
function normalise(raw: Record<string, unknown>): Customer {
  const first = String(raw.first_name ?? '');
  const last  = String(raw.last_name  ?? '');
  const userObj = (raw.user && typeof raw.user === 'object' ? raw.user : null) as Record<string, unknown> | null;
  const userCreatedAt = userObj ? (userObj.created_at ?? userObj.date_joined ?? userObj.created) : null;
  const rawCreatedAt = raw.created_at ?? raw.date_joined ?? raw.created ?? raw.signup_date ?? raw.created_date ?? raw.registered_at ?? raw.joined_at ?? userCreatedAt;

  return {
    id:                   String(raw.id ?? ''),
    name:                 [first, last].filter(Boolean).join(' ') || String(raw.name ?? 'Unknown'),
    first_name:           first || undefined,
    last_name:            last  || undefined,
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
    created_at:           rawCreatedAt ? String(rawCreatedAt) : null,
    raw,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function parseCustomerDate(rawVal: unknown): Date | null {
  if (!rawVal) return null;
  if (rawVal instanceof Date) return isNaN(rawVal.getTime()) ? null : rawVal;
  if (typeof rawVal === 'number') {
    const d = new Date(rawVal > 1e11 ? rawVal : rawVal * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof rawVal === 'string') {
    if (/^\d{10,13}$/.test(rawVal.trim())) {
      const num = Number(rawVal.trim());
      const d = new Date(num > 1e11 ? num : num * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(rawVal);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatCustomerDate(dStr: string | null) {
  if (!dStr) return null;
  const d = parseCustomerDate(dStr);
  if (!d) return null;
  return d.toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCustomerDateTime(dStr: string | null) {
  if (!dStr) return null;
  const d = parseCustomerDate(dStr);
  if (!d) return null;
  return d.toLocaleString('en-US', { timeZone: KUWAIT_TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDob(dob: string | null) {
  if (!dob) return null;
  return new Date(dob).toLocaleDateString('en-US', { timeZone: KUWAIT_TZ, year: 'numeric', month: 'short', day: 'numeric' });
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

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, 'ellipsis', total];
  }
  if (current >= total - 2) {
    return [1, 'ellipsis', total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
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

function SelectFilter({
  label,
  value,
  options,
  icon,
  onChange,
}: {
  label: string;
  value: string;
  options: (string | { label: string; value: string })[];
  icon?: React.ReactNode;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 appearance-none rounded-xl border border-border bg-card pr-8 text-sm font-medium outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer',
          icon ? 'pl-9' : 'pl-3',
          value ? 'border-primary/50 text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        <option value="">{label}</option>
        {options.map((o) => {
          const optVal = typeof o === 'string' ? o : o.value;
          const optLabel = typeof o === 'string' ? (o.charAt(0).toUpperCase() + o.slice(1)) : o.label;
          return (
            <option key={optVal} value={optVal} className="text-foreground capitalize">
              {optLabel}
            </option>
          );
        })}
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

// ── Customer Analytics Type ───────────────────────────────────────────────────
interface CustomerAnalytics {
  success: boolean;
  customer_id: string;
  phone?: string | null;
  loyalty: {
    is_enrolled: boolean;
    balance_points: number;
    total_earned: number;
    total_redeemed: number;
    points_expire_at: string | null;
    is_expired: boolean;
    points_value_kwd: number;
    recent_transactions: Array<{
      id: string;
      transaction_type: string;
      points: number;
      booking_id?: string | null;
      booking_number?: string | null;
      description?: string | null;
      created_at?: string | null;
    }>;
  };
  gift_vouchers: {
    total_count: number;
    sent_count: number;
    received_count: number;
    active_count: number;
    redeemed_count: number;
    total_spent_on_vouchers: number;
    currency: string;
    sent_vouchers: Array<{
      id: string;
      voucher_number?: string | null;
      recipient_name?: string | null;
      recipient_phone?: string | null;
      sender_name?: string | null;
      total_amount: number;
      status: string;
      created_at?: string | null;
      redeemed_at?: string | null;
    }>;
    received_vouchers: Array<{
      id: string;
      voucher_number?: string | null;
      recipient_name?: string | null;
      recipient_phone?: string | null;
      sender_name?: string | null;
      total_amount: number;
      status: string;
      created_at?: string | null;
      redeemed_at?: string | null;
    }>;
  };
  financials: {
    total_spent: number;
    total_spent_bookings: number;
    total_spent_vouchers: number;
    total_refunded: number;
    net_revenue: number;
    average_order_value: number;
    currency: string;
    total_transactions: number;
  };
  sales_and_bookings: {
    total_bookings: number;
    completed_bookings: number;
    upcoming_bookings: number;
    cancelled_bookings: number;
    cancellation_rate_pct: number;
    first_booking_date: string | null;
    last_visit_date: string | null;
    days_since_last_visit: number | null;
    recent_bookings: Array<{
      id: string;
      booking_number?: string | null;
      invoice_number?: string | null;
      service_name?: string | null;
      branch_name?: string | null;
      therapist_name?: string | null;
      appointment_date?: string | null;
      total_amount: number;
      status: string;
      payment_status: string;
    }>;
  };
  marketing_analytics: {
    customer_tier: string;
    favorite_service?: string | null;
    favorite_service_count: number;
    preferred_branch?: string | null;
    preferred_therapist?: string | null;
    preferred_day_of_week?: string | null;
    preferred_time_slot?: string | null;
    total_treatment_hours: number;
    lifecycle_status: string;
  };
}

// ── Customer Details Modal ───────────────────────────────────────────────────
function CustomerDetailsModal({
  customer,
  onClose,
  onSendMessage,
}: {
  customer: Customer;
  onClose: () => void;
  onSendMessage: (customer: Customer) => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'finance' | 'vouchers' | 'loyalty' | 'marketing'>('overview');
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const signupDateFormatted = formatCustomerDateTime(customer.created_at);

  useEffect(() => {
    let isMounted = true;
    setLoadingAnalytics(true);
    setAnalyticsError(null);

    const query = customer.phone ? `?phone=${encodeURIComponent(customer.phone)}` : '';
    fetch(`/api/v1/customers/${encodeURIComponent(customer.id)}/analytics${query}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load customer analytics');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data && data.success) {
            setAnalytics(data);
          }
          setLoadingAnalytics(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setAnalyticsError(err instanceof Error ? err.message : 'Unable to load analytics');
          setLoadingAnalytics(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [customer.id, customer.phone]);

  const tier = analytics?.marketing_analytics?.customer_tier || 'Customer';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-fade-in-up">
        {/* Header with avatar, basic info & VIP status */}
        <div className="relative shrink-0 border-b border-border/60 bg-gradient-to-r from-primary/15 via-primary/5 to-teal-500/10 p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-xl bg-card/80 border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <Avatar customer={customer} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-foreground truncate">{customer.name}</h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                    customer.account_status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      customer.account_status === 'active' ? 'bg-emerald-500' : 'bg-muted-foreground',
                    )}
                  />
                  {customer.account_status}
                </span>

                {tier && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Sparkles className="h-3 w-3" />
                    {tier}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap font-mono">
                <span>ID: {customer.id}</span>
                {customer.gender && (
                  <span className="font-sans capitalize">
                    Gender: <strong className="text-foreground">{customer.gender}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Analytics Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            {/* Total Spent */}
            <div className="p-2.5 rounded-2xl bg-card/70 border border-border/70 backdrop-blur-xs flex items-center gap-2.5 shadow-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Spent</p>
                <p className="text-xs font-black text-foreground truncate">
                  {loadingAnalytics ? (
                    <span className="inline-block h-3 w-12 animate-pulse bg-muted rounded" />
                  ) : (
                    `${(analytics?.financials?.total_spent ?? 0).toFixed(3)} KWD`
                  )}
                </p>
              </div>
            </div>

            {/* Loyalty Points */}
            <div className="p-2.5 rounded-2xl bg-card/70 border border-border/70 backdrop-blur-xs flex items-center gap-2.5 shadow-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Award className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Loyalty Points</p>
                <p className="text-xs font-black text-foreground truncate">
                  {loadingAnalytics ? (
                    <span className="inline-block h-3 w-12 animate-pulse bg-muted rounded" />
                  ) : (
                    `${analytics?.loyalty?.balance_points ?? 0} pts`
                  )}
                </p>
              </div>
            </div>

            {/* Gift Vouchers */}
            <div className="p-2.5 rounded-2xl bg-card/70 border border-border/70 backdrop-blur-xs flex items-center gap-2.5 shadow-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Gift className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gift Vouchers</p>
                <p className="text-xs font-black text-foreground truncate">
                  {loadingAnalytics ? (
                    <span className="inline-block h-3 w-14 animate-pulse bg-muted rounded" />
                  ) : (
                    `${analytics?.gift_vouchers?.sent_count ?? 0} sent · ${analytics?.gift_vouchers?.received_count ?? 0} rcvd`
                  )}
                </p>
              </div>
            </div>

            {/* Visits & Bookings */}
            <div className="p-2.5 rounded-2xl bg-card/70 border border-border/70 backdrop-blur-xs flex items-center gap-2.5 shadow-xs">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed Visits</p>
                <p className="text-xs font-black text-foreground truncate">
                  {loadingAnalytics ? (
                    <span className="inline-block h-3 w-10 animate-pulse bg-muted rounded" />
                  ) : (
                    `${analytics?.sales_and_bookings?.completed_bookings ?? 0} of ${analytics?.sales_and_bookings?.total_bookings ?? 0}`
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="shrink-0 border-b border-border/50 bg-muted/40 px-5 pt-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer',
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <User className="h-3.5 w-3.5" />
            <span>Overview & Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finance')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer',
              activeTab === 'finance'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Finance & Spend</span>
            {analytics?.financials && (
              <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-extrabold">
                {analytics.financials.total_spent.toFixed(1)} KWD
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer',
              activeTab === 'vouchers'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Gift className="h-3.5 w-3.5" />
            <span>Gift Vouchers</span>
            {analytics?.gift_vouchers && (
              <span className="ml-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 text-[10px] font-extrabold">
                {analytics.gift_vouchers.total_count}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('loyalty')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer',
              activeTab === 'loyalty'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Loyalty Points</span>
            {analytics?.loyalty?.balance_points !== undefined && (
              <span className="ml-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-extrabold">
                {analytics.loyalty.balance_points} pts
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('marketing')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer',
              activeTab === 'marketing'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Marketing & CRM</span>
          </button>
        </div>

        {/* Body content based on active tab */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW & PROFILE */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Contact Information */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-muted/20 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Phone className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Phone Number</p>
                        <p className="text-xs font-bold text-foreground truncate">
                          {customer.phone || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    {customer.phone && (
                      <button
                        type="button"
                        onClick={() => handleCopy(customer.phone!, 'phone')}
                        title="Copy phone"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      >
                        {copiedField === 'phone' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border bg-muted/20 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Mail className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Email Address</p>
                        <p className="text-xs font-bold text-foreground truncate" title={customer.email || undefined}>
                          {customer.email || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    {customer.email && (
                      <button
                        type="button"
                        onClick={() => handleCopy(customer.email!, 'email')}
                        title="Copy email"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                      >
                        {copiedField === 'email' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Profile & Account Details */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Profile & Registration
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Date of Birth</p>
                    <p className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {formatDob(customer.dob) || '—'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Signup Date</p>
                    <p className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                      {signupDateFormatted || '—'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Loyalty Enrollment</p>
                    <p className="text-xs font-bold text-foreground mt-1 flex items-center gap-1.5">
                      {customer.is_loyalty_enrolled || analytics?.loyalty?.is_enrolled ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-semibold">Not Enrolled</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Badges */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Verification Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  <VerifiedBadge ok={customer.is_whatsapp_verified} label="WhatsApp Verified" />
                  <VerifiedBadge ok={customer.is_email_verified} label="Email Verified" />
                  <VerifiedBadge ok={customer.is_mobile_verified} label="Mobile Phone Verified" />
                </div>
              </div>

              {customer.notification_channel && (
                <div className="p-3.5 rounded-2xl border border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Preferred Notification Channel</span>
                  <span className="text-xs font-extrabold text-foreground capitalize bg-card px-3 py-1 rounded-xl border border-border">
                    {customer.notification_channel}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FINANCE & SPEND */}
          {activeTab === 'finance' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Total Customer Revenue (LTV)
                  </p>
                  <p className="text-xl font-black text-foreground mt-1">
                    {(analytics?.financials?.total_spent ?? 0).toFixed(3)} <span className="text-xs font-bold text-muted-foreground">KWD</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Net revenue: {(analytics?.financials?.net_revenue ?? 0).toFixed(3)} KWD
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Direct Appointments Spend
                  </p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {(analytics?.financials?.total_spent_bookings ?? 0).toFixed(3)} <span className="text-xs font-bold text-muted-foreground">KWD</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    From {analytics?.sales_and_bookings?.completed_bookings ?? 0} completed visits
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Gift Vouchers Spend
                  </p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {(analytics?.financials?.total_spent_vouchers ?? 0).toFixed(3)} <span className="text-xs font-bold text-muted-foreground">KWD</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    From {analytics?.gift_vouchers?.sent_count ?? 0} purchased vouchers
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Average Order Value (AOV)
                  </p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {(analytics?.financials?.average_order_value ?? 0).toFixed(3)} <span className="text-xs font-bold text-muted-foreground">KWD</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Per booking / gift transaction</p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Total Refunded
                  </p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {(analytics?.financials?.total_refunded ?? 0).toFixed(3)} <span className="text-xs font-bold text-muted-foreground">KWD</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Processed refund amount</p>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Total Completed Orders
                  </p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {analytics?.financials?.total_transactions ?? 0}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Services & vouchers purchased</p>
                </div>
              </div>

              {/* Recent Bookings Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                  <span>Recent Bookings & Appointments</span>
                  <span className="text-[11px] font-semibold lowercase text-muted-foreground">
                    showing latest {analytics?.sales_and_bookings?.recent_bookings?.length ?? 0}
                  </span>
                </h4>

                {analytics?.sales_and_bookings?.recent_bookings && analytics.sales_and_bookings.recent_bookings.length > 0 ? (
                  <div className="rounded-2xl border border-border overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b border-border text-[10px] font-bold uppercase text-muted-foreground">
                        <tr>
                          <th className="p-3">Booking Ref</th>
                          <th className="p-3">Service / Branch</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {analytics.sales_and_bookings.recent_bookings.map((b) => (
                          <tr key={b.id} className="hover:bg-muted/20 transition">
                            <td className="p-3 font-mono font-bold text-primary">
                              {b.booking_number || b.id.slice(0, 8)}
                              {b.invoice_number && (
                                <span className="block text-[10px] font-mono text-muted-foreground font-normal">
                                  {b.invoice_number}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-foreground">{b.service_name || 'Service appointment'}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                {b.branch_name && <span>{b.branch_name}</span>}
                                {b.therapist_name && <span>· {b.therapist_name}</span>}
                              </p>
                            </td>
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {b.appointment_date ? formatCustomerDateTime(b.appointment_date) : '—'}
                            </td>
                            <td className="p-3 font-bold text-foreground whitespace-nowrap">
                              {b.total_amount.toFixed(3)} KWD
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold capitalize',
                                  b.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                    : b.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                                )}
                              >
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-muted/10 text-muted-foreground text-xs">
                    No booking records found for this customer.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GIFT VOUCHERS */}
          {activeTab === 'vouchers' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Voucher Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Sent by Customer</p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {analytics?.gift_vouchers?.sent_count ?? 0} vouchers
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Spend: {(analytics?.gift_vouchers?.total_spent_on_vouchers ?? 0).toFixed(3)} KWD
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Received as Gift</p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {analytics?.gift_vouchers?.received_count ?? 0} vouchers
                  </p>
                  <p className="text-[10px] text-muted-foreground">Gifted by others to this customer</p>
                </div>

                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Active Vouchers</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {analytics?.gift_vouchers?.active_count ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Ready for redemption</p>
                </div>

                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Redeemed Vouchers</p>
                  <p className="text-lg font-black text-foreground mt-1">
                    {analytics?.gift_vouchers?.redeemed_count ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Successfully used</p>
                </div>
              </div>

              {/* Sent Vouchers List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  <span>Vouchers Sent to Friends / Family ({analytics?.gift_vouchers?.sent_vouchers?.length ?? 0})</span>
                </h4>
                {analytics?.gift_vouchers?.sent_vouchers && analytics.gift_vouchers.sent_vouchers.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.gift_vouchers.sent_vouchers.map((v) => (
                      <div key={v.id} className="p-3 rounded-2xl border border-border bg-card hover:bg-muted/20 transition flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-foreground flex items-center gap-2">
                            <span>{v.voucher_number || `VOU-${v.id.slice(0, 8)}`}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {v.created_at ? formatCustomerDate(v.created_at) : ''}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            To: <strong className="text-foreground">{v.recipient_name || v.recipient_phone || 'Recipient'}</strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-foreground">{v.total_amount.toFixed(3)} KWD</p>
                          <span
                            className={cn(
                              'inline-block mt-0.5 rounded-md px-2 py-0.2 text-[10px] font-bold capitalize',
                              v.status === 'redeemed'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : v.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                            )}
                          >
                            {v.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-center rounded-2xl border border-dashed border-border bg-muted/10 text-muted-foreground text-xs">
                    No vouchers sent by this customer.
                  </div>
                )}
              </div>

              {/* Received Vouchers List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Gift className="h-3.5 w-3.5 text-purple-500" />
                  <span>Vouchers Received ({analytics?.gift_vouchers?.received_vouchers?.length ?? 0})</span>
                </h4>
                {analytics?.gift_vouchers?.received_vouchers && analytics.gift_vouchers.received_vouchers.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.gift_vouchers.received_vouchers.map((v) => (
                      <div key={v.id} className="p-3 rounded-2xl border border-border bg-card hover:bg-muted/20 transition flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-foreground flex items-center gap-2">
                            <span>{v.voucher_number || `VOU-${v.id.slice(0, 8)}`}</span>
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {v.created_at ? formatCustomerDate(v.created_at) : ''}
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            From: <strong className="text-foreground">{v.sender_name || 'Generous Friend'}</strong>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-foreground">{v.total_amount.toFixed(3)} KWD</p>
                          <span
                            className={cn(
                              'inline-block mt-0.5 rounded-md px-2 py-0.2 text-[10px] font-bold capitalize',
                              v.status === 'redeemed'
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                : v.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                            )}
                          >
                            {v.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-center rounded-2xl border border-dashed border-border bg-muted/10 text-muted-foreground text-xs">
                    No vouchers received by this customer.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: LOYALTY POINTS */}
          {activeTab === 'loyalty' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Loyalty Balance Card */}
              <div className="p-5 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Current Balance</p>
                      {analytics?.loyalty?.is_enrolled && (
                        <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Active Account
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-black text-foreground mt-0.5">
                      {analytics?.loyalty?.balance_points ?? 0} <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Points</span>
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                      Cash redemption value: <strong className="text-foreground">{(analytics?.loyalty?.points_value_kwd ?? 0).toFixed(3)} KWD</strong>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Points Expiry Date</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">
                    {analytics?.loyalty?.points_expire_at ? formatCustomerDate(analytics.loyalty.points_expire_at) : 'Rolling 180 Days'}
                  </p>
                  {analytics?.loyalty?.is_expired && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full">
                      Expired
                    </span>
                  )}
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Lifetime Points Earned</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    +{analytics?.loyalty?.total_earned ?? 0} pts
                  </p>
                  <p className="text-[10px] text-muted-foreground">Cumulative earned points</p>
                </div>

                <div className="p-3.5 rounded-2xl border border-border bg-muted/20">
                  <p className="text-[10px] font-extrabold uppercase text-muted-foreground">Lifetime Points Redeemed</p>
                  <p className="text-lg font-black text-primary mt-1">
                    -{analytics?.loyalty?.total_redeemed ?? 0} pts
                  </p>
                  <p className="text-[10px] text-muted-foreground">Points used towards booking payments</p>
                </div>
              </div>

              {/* Recent Loyalty Transactions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Recent Points History
                </h4>

                {analytics?.loyalty?.recent_transactions && analytics.loyalty.recent_transactions.length > 0 ? (
                  <div className="space-y-2">
                    {analytics.loyalty.recent_transactions.map((t) => (
                      <div key={t.id} className="p-3 rounded-2xl border border-border bg-card flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-foreground flex items-center gap-1.5 capitalize">
                            <span
                              className={cn(
                                'h-2 w-2 rounded-full shrink-0',
                                t.transaction_type === 'earn'
                                  ? 'bg-emerald-500'
                                  : t.transaction_type === 'redeem'
                                  ? 'bg-primary'
                                  : 'bg-amber-500',
                              )}
                            />
                            {t.transaction_type}
                            {t.booking_number && (
                              <span className="font-mono text-[10px] text-muted-foreground font-normal">
                                ({t.booking_number})
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.description || `${t.points} points ${t.transaction_type}ed`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={cn(
                              'font-black text-xs font-mono',
                              t.transaction_type === 'earn' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                            )}
                          >
                            {t.transaction_type === 'earn' ? `+${t.points}` : `-${t.points}`} pts
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {t.created_at ? formatCustomerDate(t.created_at) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-muted/10 text-muted-foreground text-xs">
                    No points transactions on record yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MARKETING & CRM */}
          {activeTab === 'marketing' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Segment & Lifecycle Banner */}
              <div className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer Segment Tier</p>
                    <p className="text-base font-black text-foreground">
                      {analytics?.marketing_analytics?.customer_tier || 'New Customer'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lifecycle State</p>
                  <span className="inline-block mt-0.5 rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-foreground border border-border">
                    {analytics?.marketing_analytics?.lifecycle_status || 'Active'}
                  </span>
                </div>
              </div>

              {/* Customer Preferences Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Heart className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Favorite Service</p>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {analytics?.marketing_analytics?.favorite_service || 'None yet'}
                    </p>
                    {analytics?.marketing_analytics?.favorite_service_count ? (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Booked {analytics.marketing_analytics.favorite_service_count} times
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Preferred Branch</p>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {analytics?.marketing_analytics?.preferred_branch || 'Any branch'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Primary treatment location</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <UserCheck className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Preferred Therapist</p>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {analytics?.marketing_analytics?.preferred_therapist || 'No preference'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Frequently requested therapist</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-border bg-muted/20 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Preferred Day & Time</p>
                    <p className="text-xs font-bold text-foreground mt-0.5 truncate">
                      {analytics?.marketing_analytics?.preferred_day_of_week
                        ? `${analytics.marketing_analytics.preferred_day_of_week}`
                        : 'Flexible days'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {analytics?.marketing_analytics?.preferred_time_slot || 'Flexible hours'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Engagement & Retention Metrics */}
              <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-3">
                <h5 className="text-[11px] font-extrabold uppercase text-foreground">
                  Retention & Engagement Metrics
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase">First Visit</span>
                    <strong className="text-foreground">
                      {analytics?.sales_and_bookings?.first_booking_date
                        ? formatCustomerDate(analytics.sales_and_bookings.first_booking_date)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase">Last Visit</span>
                    <strong className="text-foreground">
                      {analytics?.sales_and_bookings?.last_visit_date
                        ? formatCustomerDate(analytics.sales_and_bookings.last_visit_date)
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase">Recency (Days)</span>
                    <strong className="text-foreground">
                      {analytics?.sales_and_bookings?.days_since_last_visit !== null && analytics?.sales_and_bookings?.days_since_last_visit !== undefined
                        ? `${analytics.sales_and_bookings.days_since_last_visit} days ago`
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase">Treatment Time</span>
                    <strong className="text-foreground">
                      {analytics?.marketing_analytics?.total_treatment_hours ?? 0} hrs
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center justify-between border-t border-border/60 bg-muted/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSendMessage(customer);
            }}
            className="flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer"
          >
            <Send className="h-4 w-4" />
            <span>Send Message</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const SIGNUP_DATE_OPTIONS: { label: string; value: SignupDateFilter }[] = [
  { label: 'Current Date', value: 'today' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'Last Month', value: 'last_month' },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { t } = useI18n();

  const [search,           setSearch]           = useState('');
  const [debouncedSearch,  setDebouncedSearch]  = useState('');
  const [page,             setPage]             = useState(1);
  const [pageSize,         setPageSize]         = useState(20);
  const [genderFilter,     setGenderFilter]     = useState('');
  const [signupDateFilter, setSignupDateFilter] = useState<SignupDateFilter>('');
  const [whatsappOnly,     setWhatsappOnly]     = useState(false);
  const [emailOnly,        setEmailOnly]        = useState(false);
  const [viewMode,         setViewMode]         = useState<'grid' | 'list'>('list');
  const [viewCustomer,     setViewCustomer]     = useState<Customer | null>(null);

  // Debounce search so we query backend cleanly
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when client filters change
  useEffect(() => {
    setPage(1);
  }, [genderFilter, whatsappOnly, emailOnly, signupDateFilter]);

  // Multi-select
  const [selectedIds,     setSelectedIds]     = useState<Set<string>>(new Set());
  const [showMsgModal,    setShowMsgModal]    = useState(false);
  const [successInfo,     setSuccessInfo]     = useState<{ channel: MessageChannel; count: number } | null>(null);

  const proxyUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }
    return `/api/v1/customers?${params.toString()}`;
  }, [page, pageSize, debouncedSearch]);

  const { data: rawCustomers, loading, error, pagination, refetch } = useApiList<Record<string, unknown>>(
    proxyUrl,
  );

  const customers = useMemo(() => rawCustomers.map(normalise), [rawCustomers]);

  const genderOptions = useMemo(
    () => ['female', 'male'],
    [],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch ? '' : search.toLowerCase();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);

    return customers.filter((c) => {
      const matchSearch   = !q || c.name.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q);
      const matchGender   = !genderFilter || c.gender === genderFilter;
      const matchWhatsapp = !whatsappOnly || c.is_whatsapp_verified;
      const matchEmail    = !emailOnly    || c.is_email_verified;

      let matchSignupDate = true;
      if (signupDateFilter) {
        const d = parseCustomerDate(c.created_at);
        if (!d) {
          matchSignupDate = false;
        } else if (signupDateFilter === 'today') {
          matchSignupDate = d >= todayStart && d <= todayEnd;
        } else if (signupDateFilter === 'last_week') {
          matchSignupDate = d >= sevenDaysAgo && d <= todayEnd;
        } else if (signupDateFilter === 'last_month') {
          matchSignupDate = d >= thirtyDaysAgo && d <= todayEnd;
        }
      }

      return matchSearch && matchGender && matchWhatsapp && matchEmail && matchSignupDate;
    });
  }, [customers, search, debouncedSearch, genderFilter, whatsappOnly, emailOnly, signupDateFilter]);

  const totalCount  = pagination?.count ?? customers.length;
  const totalPages  = pagination?.total_pages ?? Math.max(1, Math.ceil(totalCount / pageSize));
  const hasNextPage = pagination ? Boolean(pagination.next) : page < totalPages;
  const hasPrevPage = pagination ? Boolean(pagination.previous) : page > 1;
  const pageNumbers = useMemo(() => getPageNumbers(page, totalPages), [page, totalPages]);

  const hasFilter = search || genderFilter || signupDateFilter || whatsappOnly || emailOnly;
  const clearAll  = () => {
    setSearch('');
    setDebouncedSearch('');
    setGenderFilter('');
    setSignupDateFilter('');
    setWhatsappOnly(false);
    setEmailOnly(false);
    setPage(1);
  };

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

  const handleSendMessageFromPopup = useCallback((customer: Customer) => {
    setSelectedIds(new Set([customer.id]));
    setShowMsgModal(true);
  }, []);

  return (
    <DashboardShell>
      <PageHeader
        title={t('navCustomers')}
        subtitle={
          loading
            ? 'Loading…'
            : pagination
              ? `${pagination.count.toLocaleString()} ${t('navCustomers').toLowerCase()}`
              : `${customers.length} ${t('navCustomers').toLowerCase()}`
        }
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

        {/* Signup date filter */}
        <SelectFilter
          label="All Signup Dates"
          value={signupDateFilter}
          icon={<Calendar className="h-4 w-4" />}
          options={SIGNUP_DATE_OPTIONS}
          onChange={(v) => setSignupDateFilter(v as SignupDateFilter)}
        />

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
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:text-destructive transition cursor-pointer">
            Clear
          </button>
        )}

        <div className="flex-1" />
        {!loading && (
          <span className="text-xs text-muted-foreground font-medium">
            {pagination ? (
              <>
                Page <span className="font-semibold text-foreground">{page}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span> ·{' '}
                <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span> total
              </>
            ) : (
              <>{filtered.length} customers</>
            )}
          </span>
        )}

        {/* View toggle */}
        <div className="flex rounded-xl border border-border overflow-hidden">
          {(['list', 'grid'] as const).map((m) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={cn('flex h-10 w-10 items-center justify-center transition cursor-pointer',
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
            className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" /> Send Message
          </button>
          <button
            onClick={clearSelection}
            className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
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
                className={cn(
                  'group relative rounded-2xl border bg-card p-4 transition animate-fade-in-up',
                  isSelected
                    ? 'border-primary/60 bg-primary/5 shadow-md ring-2 ring-primary/20'
                    : 'border-border/50 hover:border-primary/40 hover:shadow-md',
                )}
              >
                {/* Circle selection checkbox on top right */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(c.id);
                  }}
                  aria-label={isSelected ? 'Deselect customer' : 'Select customer'}
                  className={cn(
                    'absolute top-3 right-3 h-5 w-5 rounded-full border-2 transition flex items-center justify-center shrink-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40 z-10',
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'border-border/80 bg-card hover:border-primary/60',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                </button>

                {/* Header row */}
                <div className="flex items-start gap-3 pr-8">
                  <Avatar customer={c} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-sm text-foreground">{c.name}</p>
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
                  {c.created_at && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 pt-0.5">
                      <Calendar className="h-3 w-3 text-muted-foreground/60" /> Signed up: {formatCustomerDate(c.created_at)}
                    </p>
                  )}
                </div>

                {/* Verification badges & View details button */}
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <VerifiedBadge ok={c.is_whatsapp_verified} label="WhatsApp" />
                    <VerifiedBadge ok={c.is_email_verified}    label="Email" />
                    <VerifiedBadge ok={c.is_mobile_verified}   label="Mobile" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewCustomer(c);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-primary hover:text-white hover:border-primary transition cursor-pointer shrink-0 shadow-xs"
                    title="View details"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View</span>
                  </button>
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
                {/* Select-all circle checkbox */}
                <th className="px-4 py-3 w-10">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    aria-label={allFilteredSelected ? 'Deselect all' : 'Select all'}
                    className={cn(
                      'mx-auto h-5 w-5 rounded-full border-2 transition flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                      allFilteredSelected
                        ? 'border-primary bg-primary text-white shadow-xs'
                        : someSelected
                          ? 'border-primary bg-primary/20'
                          : 'border-border/80 bg-card hover:border-primary/60',
                    )}
                  >
                    {allFilteredSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                    {!allFilteredSelected && someSelected && (
                      <span className="block h-1.5 w-1.5 bg-primary rounded-full" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden sm:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden md:table-cell">Gender</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground hidden lg:table-cell">DOB</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground hidden md:table-cell">Verified</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b border-border/30 transition',
                      isSelected
                        ? 'bg-primary/5 border-primary/20'
                        : i % 2 !== 0
                          ? 'bg-muted/10 hover:bg-muted/30'
                          : 'hover:bg-muted/30',
                    )}
                  >
                    {/* Circle Row checkbox on the left */}
                    <td className="px-4 py-3 w-10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(c.id);
                        }}
                        aria-label={isSelected ? 'Deselect customer' : 'Select customer'}
                        className={cn(
                          'mx-auto h-5 w-5 rounded-full border-2 transition flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                          isSelected
                            ? 'border-primary bg-primary text-white shadow-xs'
                            : 'border-border/80 bg-card hover:border-primary/60',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                      </button>
                    </td>

                    {/* Name & Signup date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar customer={c} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">{c.name}</p>
                          {c.created_at && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <span>Signed up: {formatCustomerDate(c.created_at)}</span>
                            </p>
                          )}
                        </div>
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

                    {/* Right-most Action button: View details in popup */}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewCustomer(c);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary hover:text-white hover:border-primary transition shadow-xs cursor-pointer group"
                        title="View customer details"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground group-hover:text-white transition" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {/* Left: Summary & page size selector */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing{' '}
              <strong className="text-foreground font-semibold">
                {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
              </strong>
              –
              <strong className="text-foreground font-semibold">
                {Math.min(page * pageSize, totalCount)}
              </strong>{' '}
              of <strong className="text-foreground font-semibold">{totalCount.toLocaleString()}</strong> customers
            </span>

            <div className="h-4 w-[1px] bg-border/80 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-border bg-muted/40 px-2 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20 cursor-pointer"
              >
                {[10, 20, 50, 100].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Page navigation buttons and jump */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick jump to page */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
              <span>Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                defaultValue={page}
                key={`jump-${page}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Number((e.target as HTMLInputElement).value);
                    if (val >= 1 && val <= totalPages) {
                      setPage(val);
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages && val !== page) {
                    setPage(val);
                  }
                }}
                className="h-8 w-14 rounded-lg border border-border bg-card px-2 text-center text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* First page button */}
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First page"
              aria-label="First page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                page === 1
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>

            {/* Previous page button */}
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevPage}
              title="Previous page"
              aria-label="Previous page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                !hasPrevPage
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Numbered page buttons */}
            <div className="flex items-center gap-1">
              {pageNumbers.map((p, idx) => {
                if (p === 'ellipsis') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-xs text-muted-foreground select-none"
                    >
                      …
                    </span>
                  );
                }
                const isCurrent = p === page;
                return (
                  <button
                    key={`page-${p}`}
                    onClick={() => setPage(p)}
                    className={cn(
                      'flex h-8 min-w-8 px-2 items-center justify-center rounded-xl text-xs font-semibold transition active:scale-95 cursor-pointer',
                      isCurrent
                        ? 'bg-primary text-white shadow-sm'
                        : 'border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next page button */}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNextPage}
              title="Next page"
              aria-label="Next page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                !hasNextPage
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Last page button */}
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Last page"
              aria-label="Last page"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer',
                page === totalPages
                  ? 'border-border/40 text-muted-foreground/30 cursor-not-allowed'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Customer Details Popup Modal */}
      {viewCustomer && (
        <CustomerDetailsModal
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
          onSendMessage={handleSendMessageFromPopup}
        />
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
