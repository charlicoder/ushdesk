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
  currency?: string;
  authHeader?: string;
  onClose: () => void;
  onUpdate: (updatedServices: EditableServiceItem[], sessionIndex: number) => void;
}

interface ApiBranchService {
  id: string;
  name: string;
  duration_minutes?: number;
  base_price?: string | number;
  price?: string | number;
  currency?: string;
  category_name?: string;
}

export function EditSessionModal({
  isOpen,
  sessionIndex,
  sessionNumber,
  sessionData,
  branchId,
  serviceArrangementId,
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
    onUpdate(services, sessionIndex);
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
              <span className="text-xs font-semibold text-muted-foreground">
                Total: <span className="font-extrabold text-foreground">{totalDuration} min</span> ·{' '}
                <span className="font-mono font-extrabold text-[#b85d63]">
                  {totalPrice.toFixed(3)} {currency}
                </span>
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
                    <button
                      type="button"
                      onClick={() => handleRemoveService(idx)}
                      disabled={services.length <= 1}
                      title={services.length <= 1 ? 'A session must have at least one service' : 'Remove service'}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground/80 hover:text-red-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Duration (Minutes)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="5"
                          step="5"
                          value={svc.duration_minutes}
                          onChange={(e) => handleUpdateDuration(idx, parseInt(e.target.value, 10) || 0)}
                          className="w-full rounded-xl border border-border/80 bg-muted/20 px-3 py-1.5 pl-8 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
                        />
                        <Clock className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                        Price ({currency})
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={svc.base_price}
                          onChange={(e) => handleUpdatePrice(idx, parseFloat(e.target.value) || 0)}
                          className="w-full rounded-xl border border-border/80 bg-muted/20 px-3 py-1.5 pl-8 text-xs font-mono font-bold text-foreground focus:border-primary focus:outline-none"
                        />
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add service button / dropdown */}
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
                          <span className="text-[11px] text-muted-foreground">
                            {bs.duration_minutes ?? 60}m
                          </span>
                          <span className="font-mono font-bold text-[#b85d63]">
                            {parseFloat(String(bs.base_price ?? bs.price ?? 0)).toFixed(3)} {currency}
                          </span>
                          <Plus className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-6 py-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Updated Session Summary
            </span>
            <span className="text-xs font-extrabold text-foreground">
              {totalDuration} min ·{' '}
              <span className="font-mono text-[#b85d63]">{totalPrice.toFixed(3)} {currency}</span>
            </span>
          </div>
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
