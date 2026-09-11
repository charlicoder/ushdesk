'use client';

/**
 * CreateCustomerModal — shared quick-add customer form.
 *
 * Posts to /uauth/api/v1/customers/ with:
 *   { phone_number, first_name, last_name, send_sqs_message: true,
 *     email? (optional), gender? (optional) }
 *
 * On success returns the newly created customer object via `onCreated`.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, User, Phone, Mail, Loader2, UserPlus, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { authedFetch } from '@/lib/authedFetch';

// ── Payload type ───────────────────────────────────────────────────────────────

export interface CreateCustomerPayload {
  phone_number: string;
  first_name: string;
  last_name: string;
  send_sqs_message: boolean;
  email?: string;
  gender?: string;
}

// Generic customer shape returned by the API after creation
export interface CreatedCustomer {
  id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone_number?: string;
  email?: string;
  avatar?: string;
  [key: string]: unknown;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Shared API method — POST /uauth/api/v1/customers/
 * Pass the Authorization header (e.g. "Bearer <token>").
 */
export async function createCustomerApi(
  payload: CreateCustomerPayload,
  authHeader: string,
): Promise<CreatedCustomer> {
  const res = await authedFetch('/api/v1/customers/', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (typeof err === 'object' && err !== null) {
        const details = Object.entries(err)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' | ');
        if (details) msg = details;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const raw: any = await res.json().catch(() => ({}));
  const item: any = (raw && typeof raw === 'object' && (raw.data ?? raw.customer ?? raw.result)) || raw;
  const id = String(
    item?.id ?? item?.customer_id ?? item?.pk ?? item?.uuid ??
    raw?.id ?? raw?.customer_id ?? raw?.pk ??
    Date.now()
  );
  const firstName = String(item?.first_name ?? raw?.first_name ?? payload.first_name ?? '').trim();
  const lastName = String(item?.last_name ?? raw?.last_name ?? payload.last_name ?? '').trim();
  const fullName = String(item?.full_name ?? raw?.full_name ?? [firstName, lastName].filter(Boolean).join(' ')).trim();
  const phoneNumber = String(item?.phone_number ?? item?.phone ?? raw?.phone_number ?? raw?.phone ?? payload.phone_number ?? '').trim();
  const email = (item?.email ?? raw?.email ?? payload.email ?? '').trim();
  const avatar = item?.avatar ?? raw?.avatar;

  return {
    ...raw,
    ...item,
    id,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    phone_number: phoneNumber,
    phone: phoneNumber,
    email: email || undefined,
    avatar: avatar || undefined,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  authHeader: string;
  onCreated: (customer: CreatedCustomer) => void;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateCustomerModal({ authHeader, onCreated, onClose }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [gender,    setGender]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim())  { setError('Last name is required.'); return; }
    if (!phone.trim())     { setError('Phone number is required.'); return; }

    const payload: CreateCustomerPayload = {
      phone_number:     phone.trim(),
      first_name:       firstName.trim(),
      last_name:        lastName.trim(),
      send_sqs_message: true,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(gender        ? { gender }               : {}),
    };

    setLoading(true);
    try {
      const created = await createCustomerApi(payload, authHeader);
      setSuccess(true);
      setTimeout(() => {
        onCreated(created);
        onClose();
      }, 600);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border/70 bg-card shadow-2xl overflow-hidden animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground tracking-tight">New Customer</h2>
              <p className="text-[11px] text-muted-foreground">Fill the details to create a new account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/60 dark:bg-emerald-950/20 px-3.5 py-3 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Customer created successfully!
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+96541028983"
                  required
                  className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* First + Last */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  First Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                  <input
                    ref={firstRef}
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Amanur"
                    required
                    className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Rashid"
                  required
                  className="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Email (optional) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Email <span className="font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Gender (optional) */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Gender <span className="font-normal normal-case">(optional)</span>
              </label>
              <div className="flex items-center gap-5">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <label
                    key={g}
                    className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={gender === g}
                      onChange={() => setGender(gender === g ? '' : g)}
                      className="h-4 w-4 accent-primary rounded cursor-pointer"
                    />
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </label>
                ))}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-card px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-border bg-muted/60 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              ) : success ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Created!</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5" /> Add Customer</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
