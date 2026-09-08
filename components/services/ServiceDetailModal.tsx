'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  X, Sparkles, Clock, Building2, MapPin, DollarSign,
  Home, CheckCircle2, AlertCircle, RefreshCw, Layers,
  Users, Scissors, ChevronRight, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/helpers';
import { useI18n } from '@/hooks/use-i18n';
import { authedFetch } from '@/lib/authedFetch';
import { useAppSelector } from '@/store/hooks';

export interface BranchInfo {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
}

export interface ArrangementInfo {
  id: string;
  name?: string;
  arrangement_name?: string;
  type?: string;
  arrangement_type?: string;
  price?: number | string;
  arrangement_price?: number | string;
  capacity?: number;
  addons?: Array<{ id: string; name: string; price?: number | string; duration_minutes?: number }>;
}

export interface ServiceDetailData {
  id: string;
  name: string;
  category?: string;
  duration_minutes: number;
  price: number;
  currency?: string;
  description?: string | null;
  image?: string | null;
  can_do_home_service?: boolean;
  branch_ids?: string[];
  branches?: BranchInfo[];
  service_arrangements?: ArrangementInfo[];
  arrangements?: ArrangementInfo[];
  therapists?: Array<{ id: string; name: string; role?: string; avatar?: string }>;
  raw?: Record<string, unknown>;
}

interface Props {
  serviceId: string;
  initialService?: Partial<ServiceDetailData> | null;
  onClose: () => void;
}

export function ServiceDetailModal({ serviceId, initialService, onClose }: Props) {
  const { t } = useI18n();
  const token = useAppSelector((s) => s.auth.token);

  const [detail, setDetail]   = useState<ServiceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch service details from /uauth/api/v1/services/<service_id>/
  const fetchDetail = async () => {
    setLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      // Primary URL as requested: /uauth/api/v1/services/<service_id>/
      const res = await authedFetch(`/uauth/api/v1/services/${serviceId}/`, { headers });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          (json as Record<string, string>)?.detail ??
          (json as Record<string, string>)?.message ??
          `Failed to load service details (${res.status})`
        );
      }

      // Unwrap data envelope if wrapped in { success, data } or { service }
      const raw = ((json?.data ?? json?.service ?? json) as Record<string, unknown>);

      // Extract branches
      const branchList: BranchInfo[] = [];
      if (Array.isArray(raw.branches)) {
        raw.branches.forEach((b) => {
          if (typeof b === 'object' && b !== null) {
            const bObj = b as Record<string, unknown>;
            branchList.push({
              id:      String(bObj.id ?? bObj.branch_id ?? ''),
              name:    String(bObj.name ?? bObj.branch_name ?? 'Branch'),
              city:    (bObj.city ?? bObj.location ?? '') as string,
              address: (bObj.address ?? '') as string,
              phone:   (bObj.phone ?? bObj.phone_number ?? '') as string,
            });
          } else if (typeof b === 'string' || typeof b === 'number') {
            branchList.push({ id: String(b), name: String(b) });
          }
        });
      }

      const duration = Number(
        raw.duration_minutes ??
        raw.duration_min ??
        raw.duration ??
        initialService?.duration_minutes ??
        60
      );

      const parsed: ServiceDetailData = {
        id:                  String(raw.id ?? raw.service_id ?? serviceId),
        name:                String(raw.name ?? raw.service_name ?? initialService?.name ?? 'Service Details'),
        category:            String(raw.category ?? raw.service_category ?? initialService?.category ?? 'General'),
        duration_minutes:    duration,
        price:               Number(raw.price ?? raw.base_price ?? raw.cost ?? initialService?.price ?? 0),
        currency:            (raw.currency ?? initialService?.currency ?? 'SAR') as string,
        description:         (raw.description ?? raw.desc ?? initialService?.description ?? null) as string | null,
        image:               (raw.image ?? raw.image_url ?? raw.image1 ?? raw.photo ?? initialService?.image ?? null) as string | null,
        can_do_home_service: raw.is_home_service_eligible === true || raw.can_do_home_service === true || raw.home_service === true || initialService?.can_do_home_service === true,
        branch_ids:          Array.isArray(raw.branch_ids) ? raw.branch_ids.map(String) : branchList.map((b) => b.id),
        branches:            branchList.length > 0 ? branchList : initialService?.branches ?? [],
        service_arrangements:(raw.service_arrangements ?? raw.arrangements ?? initialService?.service_arrangements) as ArrangementInfo[] | undefined,
        therapists:          (raw.therapists ?? raw.staff ?? initialService?.therapists) as Array<{ id: string; name: string; role?: string; avatar?: string }> | undefined,
        raw,
      };

      setDetail(parsed);
    } catch (err) {
      console.warn('Failed to load service detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Merge initial info with fetched detail for immediate display
  const current = detail ?? (initialService as ServiceDetailData | null);

  const category = current?.category ?? 'General';
  const price = current?.price ?? 0;
  const duration = current?.duration_minutes ?? 60;
  const isHomeEligible = current?.can_do_home_service ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] rounded-3xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up">

        {/* ── Top Header Image Banner ── */}
        <div className="relative h-48 sm:h-56 w-full shrink-0 bg-muted/40 overflow-hidden">
          {current?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.image}
              alt={current.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 via-slate-800 to-slate-950">
              <Sparkles className="h-16 w-16 text-primary/40" />
            </div>
          )}

          {/* Dark gradient overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-black/40 to-black/20" />

          {/* Top action buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 border border-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              <Tag className="h-3 w-3 text-primary" />
              {category}
            </span>

            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/60 border border-white/20 text-white hover:bg-black/80 transition backdrop-blur-md cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Title and Price Overlay */}
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4 z-10">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-md truncate">
                {current?.name ?? 'Loading Service…'}
              </h2>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-0.5 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
                  <Clock className="h-3 w-3" />
                  {duration} {t('min')}
                </span>
                {isHomeEligible && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 border border-sky-400/40 px-2.5 py-0.5 text-xs font-semibold text-sky-200 backdrop-blur-sm">
                    <Home className="h-3 w-3 text-sky-400" />
                    Home Service
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <span className="block text-[10px] uppercase font-bold text-white/70 tracking-wider">Price</span>
              <span className="text-xl sm:text-2xl font-black text-primary drop-shadow-md">
                {formatCurrency(price, t('currency'))}
              </span>
            </div>
          </div>
        </div>

        {/* ── Scrollable Content Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>

          {/* Error Banner if fetch failed */}
          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                onClick={fetchDetail}
                className="flex items-center gap-1 font-bold underline hover:opacity-80 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
            <p className="text-sm text-foreground/90 leading-relaxed rounded-2xl bg-muted/30 border border-border/50 p-4">
              {current?.description || 'No detailed description provided for this service.'}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
              <span className="mt-1 text-base font-bold text-foreground flex items-center gap-1">
                <Clock className="h-4 w-4 text-primary" />
                {duration} {t('min')}
              </span>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Base Price</span>
              <span className="mt-1 text-base font-bold text-foreground flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                {formatCurrency(price, t('currency'))}
              </span>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Home Service</span>
              <span className="mt-1 text-xs font-bold text-foreground flex items-center gap-1">
                {isHomeEligible ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-sky-500" />
                    Available
                  </>
                ) : (
                  <>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Center Only
                  </>
                )}
              </span>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3.5 flex flex-col">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Branches</span>
              <span className="mt-1 text-base font-bold text-foreground flex items-center gap-1">
                <Building2 className="h-4 w-4 text-indigo-500" />
                {current?.branches && current.branches.length > 0 ? current.branches.length : 'All'}
              </span>
            </div>
          </div>

          {/* ── Branches Section ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Available Branches
              </h4>
              {current?.branches && current.branches.length > 0 && (
                <span className="text-xs text-muted-foreground font-medium">
                  {current.branches.length} locations
                </span>
              )}
            </div>

            {current?.branches && current.branches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {current.branches.map((b, idx) => (
                  <div
                    key={b.id || idx}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3.5 transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{b.name}</p>
                      {b.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{b.city}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-center">
                <p className="text-xs font-semibold text-foreground">Available at all registered spa branches</p>
              </div>
            )}
          </div>

          {/* ── Service Arrangements / Add-ons (if present) ── */}
          {((current?.service_arrangements && current.service_arrangements.length > 0) ||
            (current?.arrangements && current.arrangements.length > 0)) && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-primary" />
                Arrangements & Options
              </h4>
              <div className="space-y-2">
                {(current.service_arrangements ?? current.arrangements ?? []).map((arr, idx) => (
                  <div
                    key={arr.id || idx}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{arr.arrangement_name ?? arr.name ?? `Arrangement #${idx + 1}`}</p>
                      {arr.arrangement_type && (
                        <p className="text-xs text-muted-foreground">{arr.arrangement_type}</p>
                      )}
                    </div>
                    {(arr.arrangement_price != null || arr.price != null) && (
                      <span className="font-bold text-primary">
                        {formatCurrency(Number(arr.arrangement_price ?? arr.price), t('currency'))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Qualified Therapists / Staff (if present) ── */}
          {current?.therapists && current.therapists.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Qualified Therapists
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {current.therapists.map((th, idx) => (
                  <div
                    key={th.id || idx}
                    className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                  >
                    <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary font-bold">
                      {th.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{th.name}</p>
                      {th.role && <p className="text-[10px] text-muted-foreground truncate">{th.role}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service ID reference pill */}
          <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground/70 border-t border-border/40">
            <span>Service ID: <code className="font-mono text-foreground/80">{serviceId}</code></span>
            <span>API: <code className="font-mono">/uauth/api/v1/services/{serviceId}/</code></span>
          </div>
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-card px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
