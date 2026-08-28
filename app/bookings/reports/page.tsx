'use client';
import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, BookOpen, DollarSign, CheckCircle2, XCircle,
  RefreshCw, AlertCircle,
} from 'lucide-react';
import { useBookings } from '@/hooks/use-bookings';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';

// ── Normalised booking (same as list page) ─────────────────────────────────────
interface BookingRow {
  id: string;
  branch_name: string;
  service_name: string;
  service_category: string;
  therapist_name: string;
  appointment_start: string;
  status: string;
  payment_status: string;
  payment_gateway: string | null;
  is_paid: boolean;
  total_amount: number;
  currency: string;
  booking_type: string;
}

function normalise(raw: Record<string, unknown>): BookingRow {
  const bd  = (raw.branch_data    ?? {}) as Record<string, unknown>;
  const sd  = (raw.service_data   ?? {}) as Record<string, unknown>;
  const td  = (raw.therapist_data ?? {}) as Record<string, unknown>;
  const pm  = (raw.payments_meta  ?? {}) as Record<string, unknown>;
  return {
    id:                String(raw.id ?? ''),
    branch_name:       String(bd.branch_name ?? bd.name ?? ''),
    service_name:      String(sd.name ?? ''),
    service_category:  String(sd.category ?? ''),
    therapist_name:    String(td.therapist_name ?? td.name ?? '—'),
    appointment_start: String(raw.appointment_start ?? ''),
    status:            String(raw.status ?? 'pending').toLowerCase(),
    payment_status:    String(raw.payment_status ?? '').toLowerCase(),
    payment_gateway:   (pm.payment_gateway ?? null) as string | null,
    is_paid:           pm.is_paid === true,
    total_amount:      parseFloat(String(raw.total_amount ?? '0')) || 0,
    currency:          String(raw.currency ?? 'KWD'),
    booking_type:      String(raw.booking_type ?? 'branch'),
  };
}

// ── Palette ────────────────────────────────────────────────────────────────────
const COLORS = ['#be123c', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#64748b'];

// ── Chart tooltip helpers ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-xl">
      {label && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#be123c' }} className="font-bold">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent?: 'primary' | 'success' | 'warning' | 'danger';
}) {
  const accentMap = {
    primary: 'from-rose-500 to-pink-600',
    success: 'from-emerald-500 to-teal-600',
    warning: 'from-amber-500 to-orange-600',
    danger:  'from-red-500 to-rose-600',
  };
  const gradient = accentMap[accent ?? 'primary'];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white', gradient)}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Chart Card wrapper ─────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4">
        <p className="font-bold text-sm">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Table Card ─────────────────────────────────────────────────────────────────
function RankTable({ title, rows, col1, col2 }: {
  title: string;
  rows: { label: string; count: number; revenue?: number; currency?: string }[];
  col1: string; col2: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <p className="font-bold text-sm">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground">#</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-muted-foreground">{col1}</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-muted-foreground">{col2}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row, i) => (
            <tr key={row.label} className={cn('border-t border-border/30', i % 2 !== 0 && 'bg-muted/10')}>
              <td className="px-5 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
              <td className="px-5 py-2.5 text-sm font-semibold max-w-[200px] truncate">{row.label}</td>
              <td className="px-5 py-2.5 text-right">
                <span className="text-sm font-bold text-primary">{row.count}</span>
                {row.revenue !== undefined && (
                  <p className="text-[11px] text-muted-foreground">
                    {row.revenue.toFixed(3)} {row.currency}
                  </p>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} className="px-5 py-8 text-center text-xs text-muted-foreground">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BookingReportsPage() {
  // Fetch up to 100 bookings (backend max page_size). For full analytics across
  // all data, increase by adding multi-page fetching if total_pages > 1.
  const { data: rawBookings, loading, error, refetch } = useBookings<Record<string, unknown>>(
    '/api/v1/bookings?page=1&page_size=100',
    [],
  );

  const bookings = useMemo(() => rawBookings.map(normalise), [rawBookings]);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalBookings   = bookings.length;
  const totalRevenue    = useMemo(() => bookings.reduce((s, b) => s + b.total_amount, 0), [bookings]);
  const paidBookings    = useMemo(() => bookings.filter((b) => b.is_paid).length, [bookings]);
  const cancelledCount  = useMemo(() => bookings.filter((b) => b.status === 'cancelled').length, [bookings]);
  const cancellationRate = totalBookings ? ((cancelledCount / totalBookings) * 100).toFixed(1) : '0.0';
  const avgValue         = totalBookings ? totalRevenue / totalBookings : 0;
  const currency         = bookings[0]?.currency ?? 'KWD';

  // ── Revenue by day ──────────────────────────────────────────────────────────
  const revenueByDay = useMemo(() => {
    const map = new Map<string, { revenue: number; bookings: number }>();
    bookings.forEach((b) => {
      if (!b.appointment_start) return;
      const day = b.appointment_start.slice(0, 10);
      const cur = map.get(day) ?? { revenue: 0, bookings: 0 };
      map.set(day, { revenue: cur.revenue + b.total_amount, bookings: cur.bookings + 1 });
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: Math.round(v.revenue * 1000) / 1000,
        bookings: v.bookings,
      }));
  }, [bookings]);

  // ── Bookings by branch ──────────────────────────────────────────────────────
  const byBranch = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    bookings.forEach((b) => {
      const cur = map.get(b.branch_name) ?? { count: 0, revenue: 0 };
      map.set(b.branch_name, { count: cur.count + 1, revenue: cur.revenue + b.total_amount });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, v]) => ({ name, bookings: v.count, revenue: Math.round(v.revenue * 1000) / 1000 }));
  }, [bookings]);

  // ── Bookings by service category ────────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => map.set(b.service_category, (map.get(b.service_category) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  // ── Bookings by status ──────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => map.set(b.status, (map.get(b.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [bookings]);

  // ── Revenue by payment gateway ──────────────────────────────────────────────
  const byGateway = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    bookings.forEach((b) => {
      const gw = b.payment_gateway ?? 'Unknown';
      const cur = map.get(gw) ?? { count: 0, revenue: 0 };
      map.set(gw, { count: cur.count + 1, revenue: cur.revenue + b.total_amount });
    });
    return Array.from(map.entries()).map(([name, v]) => ({
      name, bookings: v.count, revenue: Math.round(v.revenue * 1000) / 1000,
    }));
  }, [bookings]);

  // ── Top therapists table ────────────────────────────────────────────────────
  const topTherapists = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    bookings.forEach((b) => {
      const cur = map.get(b.therapist_name) ?? { count: 0, revenue: 0 };
      map.set(b.therapist_name, { count: cur.count + 1, revenue: cur.revenue + b.total_amount });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, v]) => ({ label, count: v.count, revenue: v.revenue, currency }));
  }, [bookings, currency]);

  // ── Top services table ──────────────────────────────────────────────────────
  const topServices = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    bookings.forEach((b) => {
      const cur = map.get(b.service_name) ?? { count: 0, revenue: 0 };
      map.set(b.service_name, { count: cur.count + 1, revenue: cur.revenue + b.total_amount });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([label, v]) => ({ label, count: v.count, revenue: v.revenue, currency }));
  }, [bookings, currency]);

  // ── SSR-safe mount guard ────────────────────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  if (typeof window !== 'undefined' && !mounted) setMounted(true);

  return (
    <DashboardShell>
      <PageHeader
        title="Booking Reports"
        subtitle={loading ? 'Loading…' : `Analytics from ${totalBookings} bookings`}
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

      {/* ── KPI Strip ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-28 rounded-2xl shimmer" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
          <KpiCard
            label="Total Bookings"
            value={totalBookings.toLocaleString()}
            icon={<BookOpen className="h-4 w-4" />}
            accent="primary"
          />
          <KpiCard
            label="Total Revenue"
            value={`${totalRevenue.toFixed(3)} ${currency}`}
            icon={<DollarSign className="h-4 w-4" />}
            accent="success"
          />
          <KpiCard
            label="Avg Booking Value"
            value={`${avgValue.toFixed(3)} ${currency}`}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="primary"
          />
          <KpiCard
            label="Paid Bookings"
            value={paidBookings}
            sub={`${totalBookings ? ((paidBookings / totalBookings) * 100).toFixed(0) : 0}% of total`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="success"
          />
          <KpiCard
            label="Cancellation Rate"
            value={`${cancellationRate}%`}
            sub={`${cancelledCount} cancelled`}
            icon={<XCircle className="h-4 w-4" />}
            accent={parseFloat(cancellationRate) > 10 ? 'danger' : 'warning'}
          />
        </div>
      )}

      {/* ── Charts Row 1: Revenue trend + Bookings by Branch ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Revenue by day — wide */}
        <div className="xl:col-span-2">
          <ChartCard title="Revenue Over Time" subtitle="Daily revenue from appointments">
            {!mounted || loading ? (
              <div className="h-56 rounded-xl shimmer" />
            ) : revenueByDay.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No data</div>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#be123c" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#be123c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="revenue" name={`Revenue (${currency})`} stroke="#be123c" strokeWidth={2.5} fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Status donut */}
        <ChartCard title="Booking by Status" subtitle="Distribution of booking outcomes">
          {!mounted || loading ? (
            <div className="h-56 rounded-xl shimmer" />
          ) : byStatus.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No data</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" label={({ name, percent }) =>
                      percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''
                    } labelLine={false}>
                    {byStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 2: Branch bar + Category pie ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* Bookings by branch */}
        <ChartCard title="Bookings by Branch" subtitle="Total bookings per branch location">
          {!mounted || loading ? (
            <div className="h-56 rounded-xl shimmer" />
          ) : byBranch.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No data</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBranch} margin={{ top: 4, right: 4, left: -20, bottom: 40 }} barSize={28}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                    angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="bookings" name="Bookings" fill="#be123c" radius={[6, 6, 0, 0]}>
                    {byBranch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        {/* Service category pie */}
        <ChartCard title="Bookings by Service Category" subtitle="Which service types are most popular">
          {!mounted || loading ? (
            <div className="h-56 rounded-xl shimmer" />
          ) : byCategory.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No data</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} cx="50%" cy="50%" outerRadius={85}
                    dataKey="value" nameKey="name"
                    label={({ name, percent }) => percent > 0.06 ? `${(percent * 100).toFixed(0)}%` : ''}
                    labelLine={false}>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Charts Row 3: Payment Gateway ── */}
      <div className="mb-4">
        <ChartCard title="Revenue by Payment Gateway" subtitle="Total collected per payment method">
          {!mounted || loading ? (
            <div className="h-48 rounded-xl shimmer" />
          ) : byGateway.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGateway} layout="vertical" margin={{ top: 4, right: 20, left: 20, bottom: 0 }} barSize={20}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="revenue" name={`Revenue (${currency})`} radius={[0, 6, 6, 0]}>
                    {byGateway.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Tables Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RankTable
          title="Top Therapists by Bookings"
          rows={topTherapists}
          col1="Therapist"
          col2="Bookings"
        />
        <RankTable
          title="Top Services by Bookings"
          rows={topServices}
          col1="Service"
          col2="Bookings"
        />
      </div>
    </DashboardShell>
  );
}
