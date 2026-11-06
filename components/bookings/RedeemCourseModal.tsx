'use client';

import React, { useEffect, useState } from 'react';
import { authedFetch } from '@/lib/fetcher';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookMarked,
  Layers,
} from 'lucide-react';

interface RedeemCourseModalProps {
  subscription: Record<string, any>;
  onClose: () => void;
  onSuccess?: (booking?: Record<string, any>) => void;
}

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

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
  '21:00', '21:30', '22:00',
];

export function RedeemCourseModal({ subscription, onClose, onSuccess }: RedeemCourseModalProps) {
  const [branches, setBranches] = useState<Record<string, any>[]>([]);
  const [arrangements, setArrangements] = useState<Record<string, any>[]>([]);
  const [therapists, setTherapists] = useState<Record<string, any>[]>([]);

  const [branchId, setBranchId] = useState('');
  const [arrangementId, setArrangementId] = useState('');
  const [therapistId, setTherapistId] = useState('');
  const [secondaryTherapistId, setSecondaryTherapistId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('10:00');
  const [customerNotes, setCustomerNotes] = useState('');

  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<Record<string, any> | null>(null);

  const requiredArrangementType = String(subscription.arrangement_type || 'single_room');
  const isCoupleArrangement =
    requiredArrangementType === 'couple_room' || requiredArrangementType === 'double_room';

  const serviceDuration =
    Number(subscription.course_data?.service?.duration_minutes) ||
    Number(subscription.course_data?.duration_minutes) ||
    60;

  // Load branches
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingBranches(true);
      try {
        const res = await authedFetch('/api/v1/branches');
        const json = await res.json().catch(() => ({}));
        const list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.results)
          ? json.results
          : Array.isArray(json)
          ? json
          : [];
        if (mounted) {
          setBranches(list);
          if (list.length > 0) {
            setBranchId(String(list[0].id));
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
  }, []);

  // Load arrangements & therapists when branch changes
  useEffect(() => {
    if (!branchId) {
      setArrangements([]);
      setTherapists([]);
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingResources(true);
      try {
        const [arrRes, thRes] = await Promise.all([
          authedFetch(`/api/v1/service-arrangements?branch_id=${branchId}`),
          authedFetch(`/api/v1/therapists?branch_id=${branchId}`),
        ]);
        const arrJson = await arrRes.json().catch(() => ({}));
        const thJson = await thRes.json().catch(() => ({}));

        const allArr = Array.isArray(arrJson?.data)
          ? arrJson.data
          : Array.isArray(arrJson?.results)
          ? arrJson.results
          : Array.isArray(arrJson)
          ? arrJson
          : [];

        const allTh = Array.isArray(thJson?.data)
          ? thJson.data
          : Array.isArray(thJson?.results)
          ? thJson.results
          : Array.isArray(thJson)
          ? thJson
          : [];

        // Filter arrangements matching subscription.arrangement_type if possible
        const matchingArr = allArr.filter((a: Record<string, any>) => {
          const aType = a.arrangement_type || a.type || a.room_type;
          return !aType || aType === requiredArrangementType;
        });
        const finalArr = matchingArr.length > 0 ? matchingArr : allArr;

        if (mounted) {
          setArrangements(finalArr);
          setTherapists(allTh);
          setArrangementId(finalArr[0]?.id ? String(finalArr[0].id) : '');
          setTherapistId(allTh[0]?.id ? String(allTh[0].id) : '');
          setSecondaryTherapistId(allTh[1]?.id ? String(allTh[1].id) : '');
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
  }, [branchId, requiredArrangementType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!branchId) {
      setError('Please select a branch.');
      return;
    }
    if (!arrangementId) {
      setError('Please select a room / service arrangement.');
      return;
    }
    if (!therapistId) {
      setError('Please select a therapist.');
      return;
    }
    if (!appointmentDate || !appointmentTime) {
      setError('Please select appointment date and time.');
      return;
    }

    if (subscription.expires_at) {
      const apptIso = new Date(`${appointmentDate}T${appointmentTime}:00`);
      const expIso = new Date(subscription.expires_at);
      if (apptIso >= expIso) {
        setError(
          `Appointment must be scheduled before subscription expiry (${expIso.toLocaleDateString()}).`
        );
        return;
      }
    }

    const selectedBranch = branches.find((b) => String(b.id) === String(branchId));
    const selectedArr = arrangements.find((a) => String(a.id) === String(arrangementId));
    const selectedTherapist = therapists.find((t) => String(t.id) === String(therapistId));
    const selectedSecondary = therapists.find((t) => String(t.id) === String(secondaryTherapistId));

    const arrName =
      selectedArr?.name ||
      selectedArr?.arrangement_name ||
      selectedArr?.room_number ||
      ARRANGEMENT_LABELS[requiredArrangementType] ||
      'Room';

    const therapistName =
      selectedTherapist?.name ||
      `${selectedTherapist?.first_name || ''} ${selectedTherapist?.last_name || ''}`.trim() ||
      'Therapist';

    const secondaryName = selectedSecondary
      ? selectedSecondary.name ||
        `${selectedSecondary.first_name || ''} ${selectedSecondary.last_name || ''}`.trim()
      : undefined;

    const payload: Record<string, any> = {
      course_subscription_id: subscription.id,
      customer_id: subscription.customer_id,
      customer_data: subscription.customer_data || undefined,
      branch_id: branchId,
      branch_data: selectedBranch
        ? {
            id: selectedBranch.id,
            name: selectedBranch.name || selectedBranch.branch_name || 'Branch',
          }
        : undefined,
      service_arrangement_id: arrangementId,
      therapist_id: therapistId,
      therapist_data: {
        id: therapistId,
        name: therapistName,
      },
      secondary_therapist_id: isCoupleArrangement && secondaryTherapistId ? secondaryTherapistId : null,
      secondary_therapist_data:
        isCoupleArrangement && secondaryTherapistId && secondaryName
          ? { id: secondaryTherapistId, name: secondaryName }
          : undefined,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center">
              <BookMarked className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Redeem Course Session</h3>
              <p className="text-xs text-white/70">
                {subscription.subscription_number} · {subscription.course_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdBooking ? (
          <div className="p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-[#2C241D]">Course Session Booked!</h4>
              <p className="text-sm text-[#6E6259] mt-1">
                Session has been reserved from subscription{' '}
                <span className="font-mono font-semibold text-[#2C241D]">
                  {subscription.subscription_number}
                </span>
                .
              </p>
            </div>
            <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E5E0D8] text-left text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6E6259]">Booking Number</span>
                <span className="font-mono font-semibold text-[#2C241D]">
                  {createdBooking.booking_number || createdBooking.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6259]">Service</span>
                <span className="font-medium text-[#2C241D]">{subscription.service_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6259]">Date & Time</span>
                <span className="font-medium text-[#2C241D]">
                  {appointmentDate} at {appointmentTime}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6E6259]">Amount Due</span>
                <span className="font-semibold text-emerald-700">0.000 KWD (Prepaid Course)</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-medium hover:bg-[#3F342A] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            {/* Subscription Snapshot */}
            <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E5E0D8] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                  Customer
                </span>
                <span className="text-sm font-semibold text-[#2C241D]">
                  {customerName}
                  {subscription.customer_data?.phone_number
                    ? ` (${subscription.customer_data.phone_number})`
                    : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                  Locked Service
                </span>
                <span className="text-sm font-medium text-[#2C241D] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                  {subscription.service_name || subscription.course_name} ({serviceDuration} min)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                  Locked Room Type
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#C5A059]/15 text-[#7C5E24] border border-[#C5A059]/30">
                  {ARRANGEMENT_LABELS[requiredArrangementType] || requiredArrangementType}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                  Remaining Balance
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  {subscription.available_sessions} of {subscription.total_sessions} sessions available
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Branch */}
            <div>
              <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                Branch *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={loadingBranches}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                required
              >
                <option value="">Select Branch...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.branch_name || b.code || b.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                  Appointment Date *
                </label>
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                  <Clock className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                  Time Slot *
                </label>
                <select
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  required
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Room / Arrangement */}
            <div>
              <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                <Layers className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                Room / Arrangement ({ARRANGEMENT_LABELS[requiredArrangementType] || requiredArrangementType}) *
              </label>
              <select
                value={arrangementId}
                onChange={(e) => setArrangementId(e.target.value)}
                disabled={loadingResources}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                required
              >
                <option value="">
                  {loadingResources ? 'Loading rooms...' : 'Select Room / Arrangement...'}
                </option>
                {arrangements.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.arrangement_name || a.room_number || a.id}
                    {a.arrangement_type ? ` (${ARRANGEMENT_LABELS[a.arrangement_type] || a.arrangement_type})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Therapist(s) */}
            <div className={isCoupleArrangement ? 'grid grid-cols-2 gap-3' : ''}>
              <div>
                <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                  <UserCheck className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                  Primary Therapist *
                </label>
                <select
                  value={therapistId}
                  onChange={(e) => setTherapistId(e.target.value)}
                  disabled={loadingResources}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  required
                >
                  <option value="">
                    {loadingResources ? 'Loading therapists...' : 'Select Therapist...'}
                  </option>
                  {therapists.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.id}
                    </option>
                  ))}
                </select>
              </div>

              {isCoupleArrangement && (
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                    <UserCheck className="w-3.5 h-3.5 inline mr-1 text-[#C5A059]" />
                    Secondary Therapist
                  </label>
                  <select
                    value={secondaryTherapistId}
                    onChange={(e) => setSecondaryTherapistId(e.target.value)}
                    disabled={loadingResources}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  >
                    <option value="">Optional 2nd Therapist...</option>
                    {therapists
                      .filter((t) => String(t.id) !== String(therapistId))
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim() || t.id}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-[#4A3F35] mb-1.5">
                Session Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Any special preferences for this course session..."
                className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm font-medium text-[#6E6259] hover:bg-[#FAF8F5] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-medium hover:bg-[#3F342A] disabled:opacity-50 flex items-center gap-2 transition-colors"
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
