'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { authedFetch } from '@/lib/authedFetch';
import { cn } from '@/lib/utils';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookMarked,
  Gift,
  Check,
} from 'lucide-react';

interface RedeemCourseModalProps {
  subscription: Record<string, any>;
  onClose: () => void;
  onSuccess?: (booking?: Record<string, any>) => void;
}

// Brand palette matching CreateVoucherModal (#543C30)
const B = {
  espresso: '#543C30',
  espressoLt: '#6b4f41',
  linen: '#dbcdc2',
  blush: '#daccc1',
  lineMuted: '#e8ddd7',
  bg: '#faf7f5',
  cardBg: '#ffffff',
  textMain: '#2c1a12',
  textMuted: '#8a6f63',
  pillBg: '#f2ede9',
} as const;

const ARR_FALLBACKS = [
  'linear-gradient(135deg,#daccc1 0%,#c4a99c 100%)',
  'linear-gradient(135deg,#d4c4b8 0%,#b89d8e 100%)',
  'linear-gradient(135deg,#e2d7d0 0%,#cbb9af 100%)',
  'linear-gradient(135deg,#c9b8ae 0%,#a8897c 100%)',
];

const ARRANGEMENT_LABELS: Record<string, string> = {
  single_room: 'Single Room',
  couple_room: 'Couple Room',
  double_room: 'Double Room',
  open_area: 'Open Area',
  vip_suite: 'VIP Suite',
  private_suite: 'Private Suite',
  thai_room: 'Thai Room',
  japanese_room: 'Japanese Room',
  other: 'Other',
};

function fmtPrice(val: string | number | null | undefined, currency = 'KWD'): string {
  const n = parseFloat(String(val ?? 0));
  return `${isNaN(n) ? '0.000' : n.toFixed(3)} ${currency}`;
}

function isHomeServiceBranch(
  b: { id?: string; branch_id?: string; name?: string; branch_name?: string } | null | undefined
): boolean {
  if (!b) return false;
  const rawName = String(b.name ?? b.branch_name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  const rawId = String(b.id ?? b.branch_id ?? '').trim().toLowerCase();
  return (
    rawName === 'home service' ||
    rawName === 'home' ||
    rawId === 'home_service' ||
    rawId === 'home'
  );
}

function normalizeArrType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function parseTimeToMinutes(str: string): number {
  if (!str) return 0;
  const s = str.trim();
  const matchAmPm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1], 10);
    const m = parseInt(matchAmPm[2], 10);
    const period = matchAmPm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const match24 = s.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
  }
  return 0;
}

function to24HourHHMM(label: string): string {
  if (!label) return '10:00';
  const clean = label.trim();
  const matchAmPm = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1], 10);
    const m = matchAmPm[2];
    const ampm = matchAmPm[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  }
  return '10:00';
}

function getTherapistDisplayName(t: Record<string, any> | null | undefined): string {
  if (!t) return 'Therapist';
  const name =
    t.full_name ??
    t.name ??
    t.therapist_name ??
    [t.first_name, t.last_name].filter(Boolean).join(' ');
  return (name && String(name).trim()) || 'Therapist';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="h-3.5 w-3.5" style={{ color: B.espresso }} />
      <span
        className="text-[11px] font-extrabold uppercase tracking-widest"
        style={{ color: B.espresso }}
      >
        {label}
      </span>
    </div>
  );
}

function ArrangementCard({
  arr,
  active,
  onSelect,
  index,
  fallbackPrice,
}: {
  arr: Record<string, any>;
  active: boolean;
  onSelect: () => void;
  index: number;
  fallbackPrice?: string | number;
}) {
  const fallback = ARR_FALLBACKS[index % ARR_FALLBACKS.length];
  const currency = arr.currency ?? 'KWD';
  const name = String(arr.arrangement_name ?? arr.name ?? arr.title ?? 'Room');
  const priceRaw =
    arr.arrangement_price ??
    arr.price ??
    arr.base_price ??
    arr.amount ??
    arr.cost ??
    fallbackPrice;
  const priceNum = parseFloat(String(priceRaw ?? ''));
  const hasPrice = priceRaw != null && priceRaw !== '' && !isNaN(priceNum) && priceNum > 0;
  const arrType = (arr.arrangement_type ?? arr.type) as string | undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative shrink-0 rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.97] focus:outline-none cursor-pointer"
      style={{
        width: 160,
        height: 210,
        border: `3px solid ${active ? B.espresso : 'transparent'}`,
        boxShadow: active
          ? `0 0 0 1px ${B.espresso}, 0 6px 24px 0 ${B.espresso}40`
          : '0 2px 8px 0 rgba(0,0,0,0.13)',
        flexShrink: 0,
      }}
    >
      <div className="absolute inset-0">
        {arr.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={arr.image} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: fallback }} />
        )}
      </div>

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.30) 55%, transparent 100%)',
        }}
      />

      {hasPrice && (
        <div
          className="absolute top-2.5 right-2.5 rounded-xl px-2 py-1 leading-none"
          style={{
            background: B.espresso,
            color: B.linen,
            fontSize: 11,
            fontWeight: 800,
            boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
          }}
        >
          {fmtPrice(priceNum, currency)}
        </div>
      )}

      {active && (
        <div
          className="absolute top-2.5 left-2.5 h-6 w-6 rounded-full grid place-items-center"
          style={{ background: B.espresso, boxShadow: `0 2px 8px ${B.espresso}70` }}
        >
          <Check className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8 text-left">
        <p
          className="text-[13px] font-extrabold leading-tight text-white mb-2"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
        >
          {name.length > 17 ? name.slice(0, 16) + '…' : name}
        </p>

        <div className="flex items-center gap-1 flex-wrap">
          {arrType && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: 'rgba(255,255,255,0.20)',
                backdropFilter: 'blur(4px)',
                color: '#fff',
              }}
            >
              {arrType.replace(/_/g, ' ')}
            </span>
          )}
          {arr.capacity != null && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: 'rgba(255,255,255,0.20)',
                backdropFilter: 'blur(4px)',
                color: '#fff',
              }}
            >
              Cap {arr.capacity}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function RedeemCourseModal({ subscription, onClose, onSuccess }: RedeemCourseModalProps) {
  const [branches, setBranches] = useState<Record<string, any>[]>([]);
  const [serviceFullDetail, setServiceFullDetail] = useState<Record<string, any> | null>(null);
  const [arrangements, setArrangements] = useState<Record<string, any>[]>([]);
  const [therapists, setTherapists] = useState<Record<string, any>[]>([]);
  const [availabilitiesData, setAvailabilitiesData] = useState<any>(null);

  const [branchId, setBranchId] = useState('');
  const [arrangementId, setArrangementId] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [secondaryTherapistId, setSecondaryTherapistId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Record<string, any> | null>(null);

  const requiredArrangementType = String(subscription.arrangement_type || 'single_room');
  const serviceId = String(subscription.service_id || subscription.course_data?.service?.id || '');
  const serviceDuration =
    Number(subscription.course_data?.service?.duration_minutes) ||
    Number(subscription.course_data?.duration_minutes) ||
    60;
  const fallbackUnitPrice =
    subscription.course_data?.unit_price ||
    subscription.course_data?.service?.base_price ||
    (subscription.total_sessions
      ? (Number(subscription.price || 0) / Number(subscription.total_sessions)).toFixed(3)
      : '0.000');

  // 1. Load service full-detail + active branches (same pattern as CreateVoucherModal)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingBranches(true);
      try {
        const [bRes, detailRes] = await Promise.all([
          authedFetch('/api/v1/branches?page_size=200'),
          serviceId
            ? authedFetch(`/api/v1/services/${serviceId}/full-detail/`).catch(() => null)
            : Promise.resolve(null),
        ]);

        const bJson = await bRes.json().catch(() => ({}));
        const rawBranches: Record<string, any>[] = Array.isArray(bJson)
          ? bJson
          : bJson?.results ?? bJson?.data?.results ?? bJson?.data ?? bJson?.branches ?? [];
        const activeBranches = rawBranches.filter((b) => !isHomeServiceBranch(b));

        let detail: Record<string, any> | null = null;
        if (detailRes && detailRes.ok) {
          const dJson = await detailRes.json().catch(() => ({}));
          detail = (dJson?.data ?? dJson) as Record<string, any>;
        }

        let finalBranches = activeBranches;
        if (detail && Array.isArray(detail.branches) && detail.branches.length > 0) {
          const activeIds = new Set(
            activeBranches.map((b) => String(b.id ?? b.branch_id ?? '')).filter(Boolean)
          );
          const detailBranches = detail.branches.filter(
            (b: Record<string, any>) =>
              !isHomeServiceBranch(b) &&
              (activeIds.size === 0 || activeIds.has(String(b.id ?? b.branch_id ?? '')))
          );
          if (detailBranches.length > 0) {
            finalBranches = detailBranches;
          }
        }

        if (mounted) {
          setServiceFullDetail(detail);
          setBranches(finalBranches);
          if (finalBranches.length > 0) {
            const firstB = finalBranches[0];
            setBranchId(String(firstB.id ?? firstB.branch_id ?? ''));
          }
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingBranches(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [serviceId]);

  // 2. Load arrangements, therapists & slot availabilities when branch changes
  useEffect(() => {
    if (!branchId) {
      setArrangements([]);
      setTherapists([]);
      setAvailabilitiesData(null);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingResources(true);
      try {
        // Try service-specific arrangements + availabilities endpoint + therapists fallback
        const expireIso = subscription.expires_at || new Date(Date.now() + 90 * 86400000).toISOString();
        const [svcArrRes, branchArrRes, thRes, availRes] = await Promise.all([
          serviceId
            ? authedFetch(`/api/v1/services/${serviceId}/arrangements/?branch_id=${branchId}`).catch(
                () => null
              )
            : Promise.resolve(null),
          authedFetch(`/api/v1/service-arrangements?branch_id=${branchId}`).catch(() => null),
          authedFetch(`/api/v1/therapists?branch_id=${branchId}`).catch(() => null),
          serviceId
            ? authedFetch('/uauth/api/v1/spacenter/appointment-availabilities-for-voucher/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  service_id: serviceId,
                  branch_id: branchId,
                  expire_date: expireIso,
                }),
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        // Extract arrangements from fullDetail or service arrangements endpoint or branch arrangements
        const selectedBranchObj = branches.find(
          (b) => String(b.id ?? b.branch_id) === String(branchId)
        );
        const nestedFromDetail: Record<string, any>[] =
          selectedBranchObj?.service_arrangements ??
          (serviceFullDetail?.service_arrangements ?? []).filter((a: Record<string, any>) => {
            return !a.branch_id || String(a.branch_id) === String(branchId);
          });

        let apiArrs: Record<string, any>[] = [];
        if (svcArrRes && svcArrRes.ok) {
          const sj = await svcArrRes.json().catch(() => ({}));
          apiArrs = Array.isArray(sj) ? sj : sj?.data ?? sj?.results ?? [];
        }
        if (apiArrs.length === 0 && branchArrRes && branchArrRes.ok) {
          const bj = await branchArrRes.json().catch(() => ({}));
          apiArrs = Array.isArray(bj) ? bj : bj?.data ?? bj?.results ?? [];
        }

        // Merge detail images/prices with apiArrs availabilities
        const baseArrs = nestedFromDetail.length > 0 ? nestedFromDetail : apiArrs;
        const mergedArrs = baseArrs.map((arr) => {
          const matchApi = apiArrs.find((x) => String(x.id) === String(arr.id));
          return {
            ...matchApi,
            ...arr,
            availabilities: arr.availabilities ?? matchApi?.availabilities,
          };
        });

        // Filter to match subscription's arrangement_type if matching rooms exist
        const matchingArr = mergedArrs.filter((a: Record<string, any>) => {
          const aType = normalizeArrType(a.arrangement_type || a.type || a.room_type);
          return !aType || aType === normalizeArrType(requiredArrangementType);
        });
        const finalArr = matchingArr.length > 0 ? matchingArr : mergedArrs;

        // Parse availabilities response
        let availObj: any = null;
        if (availRes && availRes.ok) {
          availObj = await availRes.json().catch(() => null);
        }

        // Extract therapists from availObj or fallback to /api/v1/therapists
        const availTherapists: Record<string, any>[] = Array.isArray(availObj?.therapists)
          ? availObj.therapists
          : Array.isArray(availObj?.data?.therapists)
          ? availObj.data.therapists
          : [];

        let fallbackTherapists: Record<string, any>[] = [];
        if (thRes && thRes.ok) {
          const tj = await thRes.json().catch(() => ({}));
          fallbackTherapists = Array.isArray(tj) ? tj : tj?.data ?? tj?.results ?? [];
        }

        const finalTherapists =
          availTherapists.length > 0 ? availTherapists : fallbackTherapists;

        if (mounted) {
          setAvailabilitiesData(availObj);
          setArrangements(finalArr);
          setTherapists(finalTherapists);
          setArrangementId(finalArr[0]?.id ? String(finalArr[0].id) : '');
          setAppointmentTime('');
          setTherapistId('');
          setSecondaryTherapistId('');
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingResources(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [branchId, serviceId, requiredArrangementType, branches, serviceFullDetail, subscription.expires_at]);

  const selectedArrangement = useMemo(
    () => arrangements.find((a) => String(a.id) === String(arrangementId)) || null,
    [arrangements, arrangementId]
  );

  const isCoupleArrangement = useMemo(() => {
    const t = normalizeArrType(
      selectedArrangement?.arrangement_type ||
        selectedArrangement?.type ||
        requiredArrangementType
    );
    return t === 'couple_room' || t === 'double_room' || t.includes('couple') || t.includes('double');
  }, [selectedArrangement, requiredArrangementType]);

  // 3. Compute Time Slots Grid after branch + room selection
  const availableSlots = useMemo<{ time: string; available: boolean }[]>(() => {
    if (!branchId || !arrangementId || !appointmentDate) return [];

    const fitsDuration = (free: Set<number>, start: number) => {
      for (let k = 0; k < Math.max(1, Math.ceil(serviceDuration / 30)); k++) {
        if (!free.has(start + k * 30)) return false;
      }
      return true;
    };

    const hasTherapistAvailData = therapists.some(
      (t) => t.availabilities && typeof t.availabilities === 'object'
    );

    const therapistSlotsForDay = new Set<number>();
    const therapistCountByMin = new Map<number, number>();
    if (hasTherapistAvailData) {
      for (const t of therapists) {
        const tSlots: string[] = t.availabilities?.[appointmentDate] || [];
        const free = new Set<number>(tSlots.map((x) => parseTimeToMinutes(x)));
        free.forEach((m) => {
          therapistSlotsForDay.add(m);
          if (fitsDuration(free, m)) {
            therapistCountByMin.set(m, (therapistCountByMin.get(m) ?? 0) + 1);
          }
        });
      }
    }

    const rawArrDay = selectedArrangement?.availabilities?.[appointmentDate];
    const hasArrangementData = Array.isArray(rawArrDay);
    const rawArrSlots: string[] = hasArrangementData ? (rawArrDay as string[]) : [];
    const arrangementSlotsForDay = new Set<number>(rawArrSlots.map((s) => parseTimeToMinutes(s)));

    const branchInfo = availabilitiesData?.branch ?? availabilitiesData?.data?.branch;
    const openTime = branchInfo?.opening_time || '09:00:00';
    const closeTime = branchInfo?.closing_time || '22:30:00';
    const step = 30;

    const startMin = parseTimeToMinutes(openTime);
    let endMin = parseTimeToMinutes(closeTime);
    if (endMin <= startMin) endMin = 22 * 60 + 30;

    const allKnownMinutes = new Set<number>();
    for (let m = startMin; m <= endMin; m += step) {
      allKnownMinutes.add(m);
    }
    therapistSlotsForDay.forEach((m) => allKnownMinutes.add(m));
    arrangementSlotsForDay.forEach((m) => allKnownMinutes.add(m));

    const sortedMinutes = Array.from(allKnownMinutes).sort((a, b) => a - b);
    const minRequiredTherapists = isCoupleArrangement && therapists.length >= 2 ? 2 : 1;

    return sortedMinutes.map((m) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hd = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${String(hd).padStart(2, '0')}:${String(min).padStart(2, '0')} ${ampm}`;

      const isAvailableInTherapists =
        !hasTherapistAvailData || (therapistCountByMin.get(m) ?? 0) >= minRequiredTherapists;
      const isAvailableInArrangement =
        !hasArrangementData || fitsDuration(arrangementSlotsForDay, m);
      const available = isAvailableInTherapists && isAvailableInArrangement;

      return { time: timeLabel, available };
    });
  }, [
    branchId,
    arrangementId,
    appointmentDate,
    serviceDuration,
    therapists,
    selectedArrangement,
    availabilitiesData,
    isCoupleArrangement,
  ]);

  // Auto-select first available time slot when slots change
  useEffect(() => {
    if (availableSlots.length === 0) {
      setAppointmentTime('');
      return;
    }
    const currentValid = availableSlots.some(
      (s) => s.time === appointmentTime && s.available
    );
    if (!currentValid) {
      const firstAvail = availableSlots.find((s) => s.available);
      setAppointmentTime(firstAvail ? firstAvail.time : '');
    }
  }, [availableSlots, appointmentTime]);

  // 4. Filter available therapists for the selected time slot
  const availableTherapistsForSlot = useMemo<Record<string, any>[]>(() => {
    if (!appointmentTime || !appointmentDate || therapists.length === 0) return therapists;
    const hasTherapistAvailData = therapists.some(
      (t) => t.availabilities && typeof t.availabilities === 'object'
    );
    if (!hasTherapistAvailData) return therapists;

    const slotMin = parseTimeToMinutes(appointmentTime);
    const filtered = therapists.filter((t) => {
      const daySlots = t.availabilities?.[appointmentDate];
      if (!Array.isArray(daySlots)) return true;
      const free = new Set<number>(daySlots.map((x: string) => parseTimeToMinutes(x)));
      for (let k = 0; k < Math.max(1, Math.ceil(serviceDuration / 30)); k++) {
        if (!free.has(slotMin + k * 30)) return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered : therapists;
  }, [appointmentTime, appointmentDate, therapists, serviceDuration]);

  // Auto-select primary (and secondary if couple room) therapist
  useEffect(() => {
    if (availableTherapistsForSlot.length > 0) {
      const getTid = (t: Record<string, any>) => String(t.id ?? t.therapist_id ?? '');
      if (
        !therapistId ||
        !availableTherapistsForSlot.some((t) => getTid(t) === String(therapistId))
      ) {
        const first = availableTherapistsForSlot[0];
        setTherapistId(getTid(first));
      }
      if (isCoupleArrangement && availableTherapistsForSlot.length > 1) {
        const second = availableTherapistsForSlot.find(
          (t) => getTid(t) !== String(therapistId)
        );
        if (
          second &&
          (!secondaryTherapistId ||
            !availableTherapistsForSlot.some((t) => getTid(t) === String(secondaryTherapistId)))
        ) {
          setSecondaryTherapistId(getTid(second));
        }
      }
    } else {
      setTherapistId('');
      setSecondaryTherapistId('');
    }
  }, [availableTherapistsForSlot, therapistId, secondaryTherapistId, isCoupleArrangement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!branchId) {
      setError('Please select a branch.');
      return;
    }
    if (!arrangementId) {
      setError('Please select a room / arrangement.');
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setError('Please select appointment date and start time slot.');
      return;
    }
    if (!therapistId) {
      setError('Please select an available therapist.');
      return;
    }

    const hhmm24 = to24HourHHMM(appointmentTime);

    if (subscription.expires_at) {
      const apptIso = new Date(`${appointmentDate}T${hhmm24}:00`);
      const expIso = new Date(subscription.expires_at);
      if (apptIso >= expIso) {
        setError(
          `Appointment must be scheduled before subscription expiry (${expIso.toLocaleDateString()}).`
        );
        return;
      }
    }

    const selectedBranch = branches.find(
      (b) => String(b.id ?? b.branch_id) === String(branchId)
    );
    const selectedTherapist = therapists.find(
      (t) => String(t.id ?? t.therapist_id) === String(therapistId)
    );
    const selectedSecondary = therapists.find(
      (t) => String(t.id ?? t.therapist_id) === String(secondaryTherapistId)
    );

    const arrName =
      selectedArrangement?.arrangement_name ||
      selectedArrangement?.name ||
      selectedArrangement?.room_number ||
      ARRANGEMENT_LABELS[requiredArrangementType] ||
      'Room';

    const therapistName = getTherapistDisplayName(selectedTherapist);
    const secondaryName = selectedSecondary
      ? getTherapistDisplayName(selectedSecondary)
      : undefined;

    const payload: Record<string, any> = {
      course_subscription_id: subscription.id,
      customer_id: subscription.customer_id,
      customer_data: subscription.customer_data || undefined,
      branch_id: branchId,
      branch_data: selectedBranch
        ? {
            id: selectedBranch.id ?? selectedBranch.branch_id,
            name: selectedBranch.name || selectedBranch.branch_name || 'Branch',
          }
        : undefined,
      service_arrangement_id: arrangementId,
      therapist_id: therapistId,
      therapist_data: {
        id: therapistId,
        name: therapistName,
      },
      secondary_therapist_id:
        isCoupleArrangement && secondaryTherapistId ? secondaryTherapistId : null,
      secondary_therapist_data:
        isCoupleArrangement && secondaryTherapistId && secondaryName
          ? { id: secondaryTherapistId, name: secondaryName }
          : undefined,
      appointment_date: appointmentDate,
      appointment_time: hhmm24,
      booking_type: 'course_redemption',
      payment_type: 'course_subscription',
      booking_source: 'ushdesk',
      total_duration: serviceDuration,
      extra_minutes: 0,
      addons: [],
      customer_notes: customerNotes.trim() || null,
      services: [
        {
          service_id: subscription.service_id,
          service_data: {
            id: subscription.service_id,
            name: subscription.service_name || subscription.course_name || 'Course Service',
            duration_minutes: serviceDuration,
            base_price: '0.000',
          },
          service_arrangement_id: arrangementId,
          service_arrangement_data: {
            id: arrangementId,
            name: arrName,
            arrangement_name: arrName,
            arrangement_type: requiredArrangementType,
          },
          therapist_id: therapistId,
          therapist_data: {
            id: therapistId,
            name: therapistName,
          },
          secondary_therapist_id:
            isCoupleArrangement && secondaryTherapistId ? secondaryTherapistId : null,
          secondary_therapist_data:
            isCoupleArrangement && secondaryTherapistId && secondaryName
              ? { id: secondaryTherapistId, name: secondaryName }
              : undefined,
          base_price: '0.000',
          duration_minutes: serviceDuration,
          extra_minutes: 0,
          addons: [],
        },
      ],
    };

    setSubmitting(true);
    try {
      const res = await authedFetch('/booknpay/api/v1/bookings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          data?.error?.message ||
          data?.detail ||
          data?.message ||
          'Failed to create course redemption booking.';
        setError(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
        return;
      }
      const bookingObj = data?.data || data;
      setCreatedBooking(bookingObj);
      if (onSuccess) onSuccess(bookingObj);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error creating booking.');
    } finally {
      setSubmitting(false);
    }
  };

  const customerName =
    subscription.customer_data?.name ||
    `${subscription.customer_data?.first_name || ''} ${subscription.customer_data?.last_name || ''}`.trim() ||
    subscription.customer_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative z-10 flex flex-col w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl transition-all duration-200"
        style={{
          maxHeight: 'min(92vh, 860px)',
          background: B.cardBg,
          border: `1.5px solid ${B.linen}`,
        }}
      >
        {/* Header — #543C30 */}
        <div
          className="shrink-0 flex items-center justify-between gap-4 px-6 py-4"
          style={{ background: B.espresso }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <BookMarked className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Redeem Course Session</h2>
              <p className="text-[11px]" style={{ color: B.linen }}>
                {subscription.subscription_number} · {subscription.course_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl transition cursor-pointer hover:bg-white/20"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            aria-label="Close"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {createdBooking ? (
          <div className="p-6 space-y-5 text-center" style={{ background: B.bg }}>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: B.blush, color: B.espresso }}
            >
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold" style={{ color: B.textMain }}>
                Course Session Booked!
              </h4>
              <p className="text-sm mt-1" style={{ color: B.textMuted }}>
                Session has been reserved from subscription{' '}
                <span className="font-mono font-semibold" style={{ color: B.espresso }}>
                  {subscription.subscription_number}
                </span>
                .
              </p>
            </div>
            <div
              className="rounded-2xl p-4 border text-left text-sm space-y-2"
              style={{ background: B.cardBg, borderColor: B.linen }}
            >
              <div className="flex justify-between">
                <span style={{ color: B.textMuted }}>Booking Number</span>
                <span className="font-mono font-semibold" style={{ color: B.textMain }}>
                  {createdBooking.booking_number || createdBooking.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: B.textMuted }}>Service</span>
                <span className="font-medium" style={{ color: B.textMain }}>
                  {subscription.service_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: B.textMuted }}>Date & Time</span>
                <span className="font-medium" style={{ color: B.textMain }}>
                  {appointmentDate} at {appointmentTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: B.textMuted }}>Amount Due</span>
                <span className="font-semibold" style={{ color: B.espresso }}>
                  0.000 KWD (Prepaid Course)
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors cursor-pointer"
                style={{ background: B.espresso }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
            style={{
              background: B.bg,
              scrollbarWidth: 'thin',
              scrollbarColor: `${B.linen} transparent`,
            }}
          >
            {/* Subscription Snapshot */}
            <div
              className="rounded-2xl p-4 border space-y-2.5"
              style={{ background: B.cardBg, borderColor: B.linen }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Customer
                </span>
                <span className="text-sm font-bold" style={{ color: B.textMain }}>
                  {customerName}
                  {subscription.customer_data?.phone_number
                    ? ` (${subscription.customer_data.phone_number})`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Locked Service
                </span>
                <span
                  className="text-sm font-semibold flex items-center gap-1.5"
                  style={{ color: B.textMain }}
                >
                  <Sparkles className="w-3.5 h-3.5" style={{ color: B.espresso }} />
                  {subscription.service_name || subscription.course_name} ({serviceDuration} min)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Locked Room Type
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold border"
                  style={{
                    background: B.pillBg,
                    color: B.espresso,
                    borderColor: B.linen,
                  }}
                >
                  {ARRANGEMENT_LABELS[requiredArrangementType] || requiredArrangementType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: B.textMuted }}
                >
                  Remaining Balance
                </span>
                <span className="text-xs font-extrabold" style={{ color: B.espresso }}>
                  {subscription.available_sessions} of {subscription.total_sessions} sessions
                  available
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. BRANCH (Exact Create Gift Voucher style) */}
            <div>
              <SectionLabel icon={MapPin} label="Branch" />
              {loadingBranches ? (
                <div className="flex items-center gap-2 text-xs py-2" style={{ color: B.textMuted }}>
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: B.espresso }} />
                  Loading branches…
                </div>
              ) : branches.length === 0 ? (
                <p className="text-xs italic" style={{ color: B.textMuted }}>
                  No branches available.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {branches.map((b) => {
                    const bid = String(b.id ?? b.branch_id ?? '');
                    const bname = b.name ?? b.branch_name ?? bid;
                    const active = String(branchId) === bid;
                    return (
                      <button
                        key={bid}
                        type="button"
                        onClick={() => setBranchId(bid)}
                        className="flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all cursor-pointer"
                        style={{
                          borderColor: active ? B.espresso : B.linen,
                          background: active ? B.blush : B.cardBg,
                        }}
                      >
                        <div
                          className="h-4 w-4 rounded-full border-2 grid place-items-center shrink-0 transition"
                          style={{
                            borderColor: active ? B.espresso : B.linen,
                            background: active ? B.espresso : 'transparent',
                          }}
                        >
                          {active && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <p className="text-sm font-semibold" style={{ color: B.textMain }}>
                          {bname}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. ROOM / ARRANGEMENT (Exact Create Gift Voucher card style) */}
            {branchId && (
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel icon={Gift} label="Room / Arrangement" />
                  <span className="text-[10px]" style={{ color: B.textMuted }}>
                    {arrangements.length} option{arrangements.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {loadingResources ? (
                  <div className="flex items-center gap-2 text-xs py-3" style={{ color: B.textMuted }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: B.espresso }} />
                    Loading rooms & arrangements…
                  </div>
                ) : arrangements.length === 0 ? (
                  <p className="text-xs italic" style={{ color: B.textMuted }}>
                    No room arrangements available for this branch.
                  </p>
                ) : (
                  <div
                    className="overflow-x-auto"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${B.linen} transparent`,
                    }}
                  >
                    <div className="flex gap-3 pb-3" style={{ width: 'max-content' }}>
                      {arrangements.map((arr, idx) => (
                        <ArrangementCard
                          key={arr.id ?? idx}
                          arr={arr}
                          active={String(arrangementId) === String(arr.id)}
                          onSelect={() => setArrangementId(String(arr.id))}
                          index={idx}
                          fallbackPrice={fallbackUnitPrice}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. APPOINTMENT DATE */}
            {branchId && arrangementId && (
              <div>
                <SectionLabel icon={Calendar} label="Appointment Date" />
                <input
                  type="date"
                  value={appointmentDate}
                  min={new Date().toISOString().split('T')[0]}
                  max={
                    subscription.expires_at
                      ? new Date(subscription.expires_at).toISOString().split('T')[0]
                      : undefined
                  }
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border bg-white text-sm font-semibold focus:outline-none"
                  style={{
                    borderColor: B.linen,
                    color: B.textMain,
                  }}
                  required
                />
              </div>
            )}

            {/* 4. TIMESLOT GRID (Shown after branch & room selection) */}
            {branchId && arrangementId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel icon={Clock} label="Select Start Time" />
                  <span className="text-[11px] font-semibold" style={{ color: B.textMuted }}>
                    {availableSlots.filter((s) => s.available).length} available
                  </span>
                </div>

                {availableSlots.length > 0 ? (
                  <div
                    className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: `${B.linen} transparent` }}
                  >
                    {availableSlots.map((slot) => {
                      const isSel = slot.time === appointmentTime;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setAppointmentTime(slot.time)}
                          className={cn(
                            'py-2 px-1 text-center rounded-xl text-xs font-bold border transition cursor-pointer',
                            !slot.available && 'opacity-40 cursor-not-allowed line-through'
                          )}
                          style={{
                            borderColor: isSel ? B.espresso : B.linen,
                            background: isSel ? B.espresso : slot.available ? B.cardBg : B.pillBg,
                            color: isSel ? '#ffffff' : B.textMain,
                            boxShadow: isSel ? `0 2px 8px ${B.espresso}40` : undefined,
                          }}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: B.textMuted }}>
                    No time slots available for this date and room.
                  </p>
                )}
              </div>
            )}

            {/* 5. AVAILABLE THERAPISTS LIST (Shown as list, not dropdown) */}
            {branchId && arrangementId && appointmentTime && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <SectionLabel
                    icon={User}
                    label={
                      isCoupleArrangement
                        ? 'Select Therapists (Primary & Secondary)'
                        : 'Select Available Therapist'
                    }
                  />
                  <span className="text-[11px] font-semibold" style={{ color: B.textMuted }}>
                    {availableTherapistsForSlot.length} therapist
                    {availableTherapistsForSlot.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {availableTherapistsForSlot.length === 0 ? (
                  <p className="text-xs italic" style={{ color: B.textMuted }}>
                    No therapists available for the selected time slot.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                    {availableTherapistsForSlot.map((t) => {
                      const tId = String(t.id ?? t.therapist_id ?? '');
                      const isPrimary = tId === String(therapistId);
                      const isSecondary =
                        isCoupleArrangement && tId === String(secondaryTherapistId);
                      const isSel = isPrimary || isSecondary;
                      const tName = getTherapistDisplayName(t);

                      return (
                        <button
                          key={tId}
                          type="button"
                          onClick={() => {
                            if (!isCoupleArrangement) {
                              setTherapistId(tId);
                              return;
                            }
                            if (isPrimary) return;
                            if (isSecondary) {
                              const prevPrimary = therapistId;
                              setTherapistId(tId);
                              setSecondaryTherapistId(prevPrimary);
                            } else {
                              setSecondaryTherapistId(tId);
                            }
                          }}
                          className="flex items-center gap-3 rounded-xl border p-2.5 text-left transition cursor-pointer"
                          style={{
                            borderColor: isSel ? B.espresso : B.linen,
                            background: isSel ? B.blush : B.cardBg,
                            boxShadow: isSel ? `0 0 0 1px ${B.espresso}` : undefined,
                          }}
                        >
                          <div
                            className="h-9 w-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0"
                            style={{
                              background: isSel ? B.espresso : B.pillBg,
                              color: isSel ? '#ffffff' : B.espresso,
                            }}
                          >
                            {getInitials(tName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-xs font-bold truncate"
                              style={{ color: B.textMain }}
                            >
                              {tName}
                            </p>
                            <p className="text-[10px] font-semibold" style={{ color: B.textMuted }}>
                              {isCoupleArrangement && isPrimary
                                ? 'Primary Therapist'
                                : isCoupleArrangement && isSecondary
                                ? 'Secondary Therapist'
                                : 'Available'}
                            </p>
                          </div>
                          {isSel && (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0"
                              style={{ color: B.espresso }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label
                className="block text-[11px] font-extrabold uppercase tracking-widest mb-1.5"
                style={{ color: B.espresso }}
              >
                Session Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any special preferences for this course session..."
                className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm focus:outline-none"
                style={{ borderColor: B.linen, color: B.textMain }}
              />
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 pt-3 border-t"
              style={{ borderColor: B.linen }}
            >
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer"
                style={{
                  borderColor: B.linen,
                  color: B.textMain,
                  background: B.cardBg,
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !branchId || !arrangementId || !appointmentTime || !therapistId}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors cursor-pointer"
                style={{ background: B.espresso }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Book & Reserve Session (0.000 KWD)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
