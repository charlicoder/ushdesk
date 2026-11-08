'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Scissors, Plus, Trash2, X, Clock, DollarSign,
  AlertCircle, Loader2, CheckCircle2, Search, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { authedFetch } from '@/lib/authedFetch';

export interface EditableServiceItem {
  id?: string;
  service_id: string;
  service_name: string;
  name?: string;
  duration_minutes: number;
  base_price: number;
  price?: number;
  service_data?: Record<string, any>;
  [key: string]: any;
}

export interface EditSessionModalProps {
  isOpen: boolean;
  sessionIndex: number;
  sessionNumber: number;
  sessionData: {
    id?: string;
    session_id?: string;
    number?: number;
    therapistName?: string;
    secondaryTherapistName?: string | null;
    roomName?: string;
    timeLabel?: string;
    services?: any[];
    raw?: any;
    [key: string]: any;
  };
  branchId?: string;
  serviceArrangementId?: string;
  /** Paid bookings: services can only be swapped for ones with the same price (no add/remove/price edits). */
  restrictToSamePrice?: boolean;
  /** Whether this booking is for a package (compare using individual service price while keeping package pricing). */
  isPackageBooking?: boolean;
  currency?: string;
  authHeader?: string;
  onClose: () => void;
  /** Add-ons currently on the session (already gifted/selected) */
  addons?: any[];
  onUpdate: (updatedServices: EditableServiceItem[], sessionIndex: number, updatedAddons: any[]) => void;
}

interface ApiBranchService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  price?: string | number;
  currency?: string;
  category_name?: string;
  is_packaged_services?: boolean | string;
  is_packaged?: boolean | string;
}

export function EditSessionModal({
  isOpen,
  sessionIndex,
  sessionNumber,
  sessionData,
  branchId,
  serviceArrangementId,
  restrictToSamePrice = false,
  isPackageBooking = false,
  addons: addonsProp,
  currency = 'KWD',
  authHeader,
  onClose,
  onUpdate,
}: EditSessionModalProps) {
  // ── Normalize initial services from sessionData ──
  const initialServices = useMemo(() => {
    const rawList = Array.isArray(sessionData.services) && sessionData.services.length > 0
      ? sessionData.services
      : (Array.isArray(sessionData.raw?.services) ? sessionData.raw.services : []);

    return rawList.map((sv: any, idx: number): EditableServiceItem => {
      const sId = String(sv.service_id || sv.id || `temp-svc-${idx}`);
      const sName = String(sv.service_name || sv.name || sv.service_data?.name || `Service ${idx + 1}`);
      const sDur = Number(sv.duration_minutes ?? sv.duration ?? sv.base_duration ?? 60);
      const sPrice = parseFloat(String(sv.base_price ?? sv.price ?? sv.service_price ?? 0)) || 0;

      return {
        ...sv,
        id: sv.id,
        service_id: sId,
        service_name: sName,
        name: sName,
        duration_minutes: sDur > 0 ? sDur : 60,
        base_price: sPrice,
        price: sPrice,
      };
    });
  }, [sessionData]);

  const initialAddons: any[] = Array.isArray(addonsProp)
    ? addonsProp
    : (Array.isArray(sessionData.raw?.addons) ? sessionData.raw.addons : []);
  // Number of add-ons is capped by how many the session already has (gifted)
  const [sessionAddons, setSessionAddons] = useState<any[]>(initialAddons);
  const [arrangementAddons, setArrangementAddons] = useState<any[]>([]);

  const [services, setServices] = useState<EditableServiceItem[]>(initialServices);
  const [branchServices, setBranchServices] = useState<ApiBranchService[]>([]);
  const [loadingBranchServices, setLoadingBranchServices] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when session changes
  useEffect(() => {
    setServices(initialServices);
    setError(null);
  }, [initialServices]);

  // Fetch available services for this branch
  useEffect(() => {
    if (!isOpen) return;
    setLoadingBranchServices(true);
    const qs = branchId ? `?branch_id=${branchId}&is_active=true` : '?is_active=true';
    authedFetch(`/api/v1/services/${qs}`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.data ?? data.results ?? []);
        setBranchServices(list);
      })
      .catch((err) => {
        console.error('[EditSessionModal] Failed to load services:', err);
      })
      .finally(() => {
        setLoadingBranchServices(false);
      });
  }, [isOpen, branchId, authHeader]);

  // Services offered by this session's arrangement (room); null = unknown / not loaded
  const arrangementId = String(
    serviceArrangementId ||
      sessionData.raw?.service_arrangement_id ||
      sessionData.service_arrangement_id ||
      sessionData.raw?.service_arrangement_data?.id ||
      ''
  );
  const [arrangementServiceIds, setArrangementServiceIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!isOpen || !arrangementId) {
      setArrangementServiceIds(null);
      return;
    }
    let cancelled = false;
    authedFetch(`/api/v1/service-arrangements/${arrangementId}/services`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d) ? d : (d.data ?? d.results ?? []);
        const ids = new Set<string>(
          (list as any[])
            .filter((x) => x?.is_active !== false)
            .map((x) => String(x?.service_id ?? x?.id))
            .filter(Boolean)
        );
        setArrangementServiceIds(ids.size > 0 ? ids : null);
      })
      .catch(() => {
        if (!cancelled) setArrangementServiceIds(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, arrangementId, authHeader]);

  useEffect(() => {
    if (!isOpen || !arrangementId) {
      setArrangementAddons([]);
      return;
    }
    let cancelled = false;
    authedFetch(`/api/v1/service-arrangements/${arrangementId}/addons/`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setArrangementAddons(Array.isArray(d) ? d : (d.data ?? d.results ?? []));
      })
      .catch(() => {
        if (!cancelled) setArrangementAddons([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, arrangementId, authHeader]);

  const addonKey = (a: any) => String(a?.addon_id ?? a?.id ?? '');
  const addonPrice = (a: any) => parseFloat(String(a?.price ?? a?.base_price ?? 0)) || 0;

  // Pool: arrangement add-ons + add-ons of the services in this session
  const addonPool = useMemo(() => {
    const map = new Map<string, any>();
    arrangementAddons.forEach((a) => map.set(addonKey(a), a));
    services.forEach((sv) => {
      const full = branchServices.find((b: any) => String(b.id) === String(sv.service_id)) as any;
      ((full?.add_ons as any[]) ?? []).forEach((a) => map.set(addonKey(a), a));
    });
    return Array.from(map.values()).filter((a) => addonKey(a));
  }, [arrangementAddons, services, branchServices]);

  // Gifted limits per price: you may pick as many add-ons of a price as were originally gifted at that price
  const priceKey = (a: any) => addonPrice(a).toFixed(3);
  const giftedLimits = useMemo(() => {
    const m = new Map<string, number>();
    initialAddons.forEach((a) => m.set(priceKey(a), (m.get(priceKey(a)) ?? 0) + 1));
    return m;
  }, [initialAddons]);

  const selectableAddons = useMemo(() => {
    const map = new Map<string, any>();
    initialAddons.forEach((a) => map.set(addonKey(a), a));
    addonPool.forEach((a) => {
      if (giftedLimits.has(priceKey(a)) && !map.has(addonKey(a))) map.set(addonKey(a), a);
    });
    return Array.from(map.values());
  }, [initialAddons, addonPool, giftedLimits]);

  const selectedCountForPrice = (a: any) => sessionAddons.filter((x) => priceKey(x) === priceKey(a)).length;

  const handleToggleAddon = (a: any) => {
    const key = addonKey(a);
    const isOn = sessionAddons.some((x) => addonKey(x) === key);
    if (isOn) {
      setSessionAddons((prev) => prev.filter((x) => addonKey(x) !== key));
      return;
    }
    if (selectedCountForPrice(a) >= (giftedLimits.get(priceKey(a)) ?? 0)) return;
    setSessionAddons((prev) => [
      ...prev,
      {
        id: a.id ?? a.addon_id,
        addon_id: a.addon_id ?? a.id,
        name: a.name ?? a.addon_name,
        price: a.price ?? a.base_price ?? 0,
        duration_minutes: a.duration_minutes ?? a.duration ?? 0,
      },
    ]);
  };

  // Filter branch services (only those the session's room offers)
  const filteredAvailableServices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const inRoom = arrangementServiceIds
      ? branchServices.filter((s) => arrangementServiceIds.has(String(s.id)))
      : branchServices;
    if (!q) return inRoom;
    return inRoom.filter((s) => s.name?.toLowerCase().includes(q));
  }, [branchServices, searchQuery, arrangementServiceIds]);

  // Compute live session totals
  const totalDuration = useMemo(
    () => services.reduce((sum, sv) => sum + (Number(sv.duration_minutes) || 0), 0),
    [services]
  );
  const totalPrice = useMemo(
    () => services.reduce((sum, sv) => sum + (Number(sv.base_price) || 0), 0),
    [services]
  );

  const handleUpdateDuration = (index: number, val: number) => {
    setServices((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        duration_minutes: Math.max(5, val || 0),
      };
      return copy;
    });
  };

  const handleUpdatePrice = (index: number, val: number) => {
    setServices((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        base_price: Math.max(0, val || 0),
        price: Math.max(0, val || 0),
      };
      return copy;
    });
  };

  const handleRemoveService = (index: number) => {
    if (services.length <= 1) {
      setError('A session must contain at least one service.');
      return;
    }
    setError(null);
    setServices((prev) => prev.filter((_, i) => i !== index));
  };

  const isPkgServiceItem = (b: any): boolean =>
    b?.is_packaged_services === true ||
    String(b?.is_packaged_services ?? '').toLowerCase() === 'true' ||
    b?.is_packaged === true ||
    String(b?.is_packaged ?? '').toLowerCase() === 'true';

  const isPackageComponent = (svc: EditableServiceItem): boolean =>
    Boolean(
      isPackageBooking ||
      svc.package_id ||
      svc.package_name ||
      svc.service_data?.package_id ||
      svc.service_data?.package_name
    );

  // Resolve the individual service's own catalog price (not the package price) for comparison
  const getServiceComparisonPrice = (svc: EditableServiceItem): number => {
    const svcNameNorm = String(svc.service_name || svc.name || '').trim().toLowerCase();
    const fromBranch =
      branchServices.find((b) => String(b.id) === String(svc.service_id)) ||
      (svcNameNorm
        ? branchServices.find((b) => !isPkgServiceItem(b) && String(b.name || '').trim().toLowerCase() === svcNameNorm)
        : undefined);
    if (fromBranch) {
      const branchPrice = parseFloat(String(fromBranch.base_price ?? fromBranch.price ?? 0)) || 0;
      if (branchPrice > 0) return branchPrice;
    }
    const catalogPrice = parseFloat(String(svc.catalog_price ?? svc.service_data?.catalog_base_price ?? 0)) || 0;
    if (catalogPrice > 0) return catalogPrice;
    const compPrice = parseFloat(String(svc.component_price ?? svc.service_data?.component_price ?? 0)) || 0;
    const pkgPrice = parseFloat(String(svc.package_price ?? svc.service_data?.package_price ?? 0)) || 0;
    if (compPrice > 0 && (pkgPrice <= 0 || Math.abs(compPrice - pkgPrice) > 0.0005)) {
      return compPrice;
    }
    return Number(svc.base_price) || 0;
  };

  const samePriceOptions = (svc: EditableServiceItem): ApiBranchService[] => {
    const targetPrice = getServiceComparisonPrice(svc);
    const pkgMode = isPackageComponent(svc);
    const restrictByRoom =
      !pkgMode &&
      arrangementServiceIds !== null &&
      arrangementServiceIds.has(String(svc.service_id));

    return branchServices.filter((b) => {
      if (isPkgServiceItem(b)) return false;
      if (restrictByRoom && arrangementServiceIds && !arrangementServiceIds.has(String(b.id))) return false;
      if (String(b.id) === String(svc.service_id)) return false;
      if (services.some((x) => String(x.service_id) === String(b.id))) return false;
      const price = parseFloat(String(b.base_price ?? b.price ?? 0)) || 0;
      return Math.abs(price - targetPrice) < 0.0005;
    });
  };

  const handleReplaceService = (index: number, newId: string) => {
    const item = branchServices.find((b) => String(b.id) === newId);
    if (!item) return;
    setError(null);
    const dur = Number(item.duration_minutes) || 60;
    const pr = parseFloat(String(item.base_price ?? item.price ?? 0)) || 0;
    setServices((prev) => {
      const copy = [...prev];
      const oldSvc = copy[index];
      const preserveSlotPrice = Boolean(oldSvc && (isPackageComponent(oldSvc) || restrictToSamePrice));
      const slotPrice = preserveSlotPrice ? (Number(oldSvc.base_price ?? oldSvc.price ?? 0) || 0) : pr;
      copy[index] = {
        ...(oldSvc || {}),
        service_id: item.id,
        service_name: item.name,
        name: item.name,
        duration_minutes: dur,
        base_price: slotPrice,
        price: slotPrice,
        catalog_price: pr,
        component_price: pr,
        service_data: {
          ...(oldSvc?.service_data || {}),
          id: item.id,
          name: item.name,
          duration_minutes: dur,
          base_price: pr,
          catalog_base_price: pr,
        },
      };
      return copy;
    });
  };

  const handleAddService = (item: ApiBranchService) => {
    setError(null);
    const dur = Number(item.duration_minutes) || 60;
    const pr = parseFloat(String(item.base_price ?? item.price ?? 0)) || 0;
    const newSvc: EditableServiceItem = {
      service_id: item.id,
      service_name: item.name,
      name: item.name,
      duration_minutes: dur,
      base_price: pr,
      price: pr,
      service_data: {
        id: item.id,
        name: item.name,
        duration_minutes: dur,
        base_price: pr,
      },
    };
    setServices((prev) => [...prev, newSvc]);
    setShowAddDropdown(false);
    setSearchQuery('');
  };

  const handleApplyUpdate = () => {
    if (services.length === 0) {
      setError('Please add at least one service to this session.');
      return;
    }
    onUpdate(services, sessionIndex, sessionAddons);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-border/80 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-6 py-4.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#b85d63] text-white font-extrabold text-sm shadow-xs">
              {sessionNumber}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground">
                  Edit Session {sessionNumber} Services
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  Unsaved Staging
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {sessionData.therapistName || 'Therapist'}
                {sessionData.secondaryTherapistName ? ` + ${sessionData.secondaryTherapistName}` : ''}
                {sessionData.roomName ? ` · ${sessionData.roomName}` : ''}
                {sessionData.timeLabel ? ` · ${sessionData.timeLabel}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Service items in this session */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Scissors className="h-3.5 w-3.5 text-primary" />
                Services in Session ({services.length})
              </span>
            </div>

            <div className="space-y-2.5">
              {services.map((svc, idx) => (
                <div
                  key={svc.service_id || idx}
                  className="rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-xs transition hover:border-primary/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary text-xs font-extrabold shrink-0">
                        {idx + 1}
                      </span>
                      <p className="text-sm font-extrabold text-foreground truncate">
                        {svc.service_name || svc.name}
                      </p>
                    </div>
                    {restrictToSamePrice ? null : (
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      disabled={services.length <= 1}
                      title={services.length <= 1 ? 'A session must have at least one service' : 'Remove service'}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/80 hover:text-red-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    )}
                  </div>

                  {restrictToSamePrice && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: svc.service_id, name: String(svc.service_name || svc.name || ''), current: true },
                        ...samePriceOptions(svc).map((o) => ({ id: String(o.id), name: o.name, current: false })),
                      ]
                        .sort((x, y) => x.name.localeCompare(y.name))
                        .map((opt) => (
                          <label
                            key={opt.id}
                            className={cn(
                              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold cursor-pointer transition',
                              opt.current ? 'border-primary/50 bg-primary/10' : 'border-border/70 bg-muted/20 hover:bg-muted/40'
                            )}
                          >
                            <input
                              type="radio"
                              name={`svc-slot-${idx}`}
                              checked={opt.current}
                              onChange={() => !opt.current && handleReplaceService(idx, opt.id)}
                              className="h-3.5 w-3.5 accent-primary shrink-0"
                            />
                            <span className="truncate">{opt.name}</span>
                          </label>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add-ons: choose among same-price add-ons, limited to the gifted count */}
          {selectableAddons.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                Add-ons ({sessionAddons.length}/{initialAddons.length} selected)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectableAddons.map((a) => {
                  const checked = sessionAddons.some((x) => addonKey(x) === addonKey(a));
                  const full = !checked && selectedCountForPrice(a) >= (giftedLimits.get(priceKey(a)) ?? 0);
                  return (
                    <label
                      key={addonKey(a)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition',
                        checked ? 'border-violet-500/50 bg-violet-500/10 text-foreground' : 'border-border/70 bg-muted/20 text-foreground',
                        full ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={full}
                        onChange={() => handleToggleAddon(a)}
                        className="h-3.5 w-3.5 accent-violet-500 shrink-0"
                      />
                      <span className="truncate">{String(a.name ?? a.addon_name ?? 'Add-on')}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add service button / dropdown */}
          {!restrictToSamePrice && (
          <div className="pt-2">
            {!showAddDropdown ? (
              <button
                type="button"
                onClick={() => setShowAddDropdown(true)}
                className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-3 text-xs font-bold text-primary hover:bg-primary/10 transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Another Service to this Session
              </button>
            ) : (
              <div className="rounded-2xl border border-primary/40 bg-card p-3 shadow-lg space-y-3 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Select Service to Add
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddDropdown(false)}
                    className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search services…"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 pl-8 text-xs font-medium focus:border-primary focus:outline-none"
                    autoFocus
                  />
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
                </div>

                {loadingBranchServices ? (
                  <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-primary" /> Loading services…
                  </div>
                ) : filteredAvailableServices.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No matching services found.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {filteredAvailableServices.map((bs) => (
                      <div
                        key={bs.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAddService(bs)}
                        className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-primary/10 transition cursor-pointer text-xs group"
                      >
                        <span className="font-bold text-foreground truncate">{bs.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Plus className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-4">
          <div />
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/70 bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyUpdate}
              disabled={services.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-5 py-2.5 text-xs font-extrabold shadow-md shadow-primary/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="h-4 w-4" />
              Update Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
