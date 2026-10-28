/**
 * Booking feedback API client (ushanr → /uanr/api/v1/...).
 *
 * Staff endpoints go through the ushdesk `/uanr` proxy (auth + company_id injected).
 */
import { authedFetch } from '@/lib/authedFetch';

const BASE = '/uanr/api/v1';

export type FeedbackStatus = 'pending' | 'submitted';

export interface CreateFeedbackLinkPayload {
  booking_id: string;
  booking_number?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  services?: Array<Record<string, unknown>> | null;
  therapist_id?: string | null;
  therapist_name?: string | null;
  secondary_therapist_id?: string | null;
  secondary_therapist_name?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  appointment_start?: string | null;
  language?: 'ar' | 'en';
}

export interface FeedbackLink {
  id: string;
  public_token: string;
  feedback_url: string;
  status: FeedbackStatus;
  created: boolean;
  booking_id: string;
  submitted_at: string | null;
}

export interface FeedbackItem {
  id: string;
  public_token: string;
  status: FeedbackStatus;
  booking_id: string;
  booking_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  service_id: string | null;
  service_name: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
  secondary_therapist_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  appointment_start: string | null;
  language: string;
  service_rating: number | null;
  therapist_rating: number | null;
  arrangement_rating: number | null;
  average_rating: number | null;
  comment: string | null;
  created_at: string;
  submitted_at: string | null;
  feedback_url: string | null;
}

export interface FeedbackList {
  items: FeedbackItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface RatingAverages {
  service: number | null;
  therapist: number | null;
  arrangement: number | null;
  overall: number | null;
}

export interface FeedbackGroupSummary {
  id: string | null;
  name: string | null;
  count: number;
  averages: RatingAverages;
}

export interface FeedbackSummary {
  total_links: number;
  submitted: number;
  pending: number;
  response_rate: number;
  averages: RatingAverages;
  distribution: Record<'service' | 'therapist' | 'arrangement', Record<string, number>>;
  by_branch: FeedbackGroupSummary[];
  by_therapist: FeedbackGroupSummary[];
  by_service: FeedbackGroupSummary[];
}

export interface FeedbackQuery {
  branch_id?: string;
  therapist_id?: string;
  service_id?: string;
  status?: FeedbackStatus;
  min_rating?: number;
  max_rating?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers ?? {}) },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | string | undefined;
    const nested = err && typeof err === 'object' ? (err.message ?? err.detail) : err;
    const msg = nested ?? json.detail ?? json.message ?? `Request failed (${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return (json.data as T | undefined) ?? (json as unknown as T);
}

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const feedbackApi = {
  createLink: (payload: CreateFeedbackLinkPayload) =>
    request<FeedbackLink>('/create-feedback-link/', { method: 'POST', body: JSON.stringify(payload) }),

  list: (query: FeedbackQuery = {}) => request<FeedbackList>(`/feedback/${toQuery(query)}`),

  summary: (query: Pick<FeedbackQuery, 'branch_id' | 'therapist_id' | 'service_id' | 'date_from' | 'date_to'> = {}) =>
    request<FeedbackSummary>(`/feedback/summary/${toQuery(query)}`),
};

/** SMS / WhatsApp text for the customer (language follows the customer's preference). */
export function feedbackShareText(url: string, customerName: string | null | undefined, lang: 'ar' | 'en'): string {
  const name = (customerName ?? '').trim().split(' ')[0];
  return lang === 'en'
    ? `USHSPA: Hello${name ? ` ${name}` : ''}, thank you for visiting us. We'd love to hear your feedback: ${url}`
    : `USHSPA: مرحباً${name ? ` ${name}` : ''}، شكراً لزيارتكم. يسعدنا معرفة رأيكم عبر هذا الرابط: ${url}`;
}

