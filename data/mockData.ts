import type { Appointment, Branch, Service, Staff, Customer } from '@/types/appointment';
import { addDays, toISODate } from '@/lib/helpers';


// ── Chart Demo Datasets & Generators ───────────────────────────────────────

// 1. Earnings Trend (14-Day Overview)
export interface EarningsTrendItem {
  date: string;
  earnings: number;
  bookings: number;
}

export function generateDemoEarningsTrend(baseDate: Date = new Date()): EarningsTrendItem[] {
  const data: EarningsTrendItem[] = [];
  const earningsBase = [4200, 4800, 5300, 6100, 5800, 6900, 7500, 5400, 6200, 7100, 8300, 7600, 8900, 7800];
  const bookingsBase = [14, 16, 17, 20, 19, 23, 25, 18, 20, 24, 27, 25, 29, 26];

  for (let i = 13; i >= 0; i--) {
    const d = addDays(baseDate, -i);
    const idx = 13 - i;
    data.push({
      date: toISODate(d).slice(5),
      earnings: earningsBase[idx % earningsBase.length],
      bookings: bookingsBase[idx % bookingsBase.length],
    });
  }
  return data;
}

export const EARNINGS_TREND: EarningsTrendItem[] = generateDemoEarningsTrend();

// 2. Weekly Overview (Sun to Sat weekday breakdown)
export interface WeeklyOverviewItem {
  day: string;
  dayKey: 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
  bookings: number;
  earnings: number;
}

export const WEEKLY_OVERVIEW: WeeklyOverviewItem[] = [
  { day: 'Sun', dayKey: 'sun', bookings: 28, earnings: 8200 },
  { day: 'Mon', dayKey: 'mon', bookings: 22, earnings: 6450 },
  { day: 'Tue', dayKey: 'tue', bookings: 25, earnings: 7300 },
  { day: 'Wed', dayKey: 'wed', bookings: 30, earnings: 8900 },
  { day: 'Thu', dayKey: 'thu', bookings: 38, earnings: 11400 },
  { day: 'Fri', dayKey: 'fri', bookings: 42, earnings: 12800 },
  { day: 'Sat', dayKey: 'sat', bookings: 35, earnings: 10250 },
];

export function generateDemoWeeklyOverview(tFn?: (key: string) => string): WeeklyOverviewItem[] {
  return WEEKLY_OVERVIEW.map((item) => ({
    ...item,
    day: tFn ? tFn(item.dayKey) : item.day,
  }));
}

// 3. Revenue Trend (30-Day Bi-Daily / Multi-Point Analytics)
export interface RevenueTrendItem {
  date: string;
  revenue: number;
  bookings: number;
}

export function generateDemoRevenueTrend(baseDate: Date = new Date()): RevenueTrendItem[] {
  const data: RevenueTrendItem[] = [];
  const revPoints = [
    { offset: -28, revenue: 4200, bookings: 14 },
    { offset: -26, revenue: 3800, bookings: 12 },
    { offset: -24, revenue: 5100, bookings: 17 },
    { offset: -22, revenue: 6200, bookings: 21 },
    { offset: -20, revenue: 4800, bookings: 16 },
    { offset: -18, revenue: 5400, bookings: 18 },
    { offset: -16, revenue: 5900, bookings: 20 },
    { offset: -14, revenue: 6700, bookings: 22 },
    { offset: -12, revenue: 7100, bookings: 24 },
    { offset: -10, revenue: 5600, bookings: 19 },
    { offset: -8, revenue: 6300, bookings: 21 },
    { offset: -6, revenue: 7400, bookings: 25 },
    { offset: -4, revenue: 8100, bookings: 27 },
    { offset: -2, revenue: 7900, bookings: 26 },
    { offset: 0, revenue: 8600, bookings: 28 },
  ];

  for (const pt of revPoints) {
    const d = addDays(baseDate, pt.offset);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    data.push({
      date: `${mm}/${dd}`,
      revenue: pt.revenue,
      bookings: pt.bookings,
    });
  }
  return data;
}

export const REVENUE_TREND: RevenueTrendItem[] = [
  { date: '08/01', revenue: 4200, bookings: 14 },
  { date: '08/03', revenue: 3800, bookings: 12 },
  { date: '08/05', revenue: 5100, bookings: 17 },
  { date: '08/07', revenue: 6200, bookings: 21 },
  { date: '08/09', revenue: 4800, bookings: 16 },
  { date: '08/11', revenue: 5400, bookings: 18 },
  { date: '08/13', revenue: 5900, bookings: 20 },
  { date: '08/15', revenue: 6700, bookings: 22 },
  { date: '08/17', revenue: 7100, bookings: 24 },
  { date: '08/19', revenue: 5600, bookings: 19 },
  { date: '08/21', revenue: 6300, bookings: 21 },
  { date: '08/23', revenue: 7400, bookings: 25 },
  { date: '08/25', revenue: 8100, bookings: 27 },
  { date: '08/27', revenue: 7900, bookings: 26 },
  { date: '08/29', revenue: 8600, bookings: 28 },
];

// 4. Bookings by Hour (Full 08:00 - 22:00 distribution)
export interface HourlyBookingsItem {
  hour: string;
  bookings: number;
}

export const HOURLY_BOOKINGS: HourlyBookingsItem[] = [
  { hour: '08:00', bookings: 4 },
  { hour: '09:00', bookings: 9 },
  { hour: '10:00', bookings: 16 },
  { hour: '11:00', bookings: 21 },
  { hour: '12:00', bookings: 17 },
  { hour: '13:00', bookings: 13 },
  { hour: '14:00', bookings: 22 },
  { hour: '15:00', bookings: 28 },
  { hour: '16:00', bookings: 25 },
  { hour: '17:00', bookings: 23 },
  { hour: '18:00', bookings: 19 },
  { hour: '19:00', bookings: 15 },
  { hour: '20:00', bookings: 10 },
  { hour: '21:00', bookings: 6 },
  { hour: '22:00', bookings: 2 },
];

export function generateDemoHourlyBookings(): HourlyBookingsItem[] {
  return [...HOURLY_BOOKINGS];
}

export const SERVICE_CATEGORY_DATA = [
  { name: 'Massage', value: 38, revenue: 42800, color: '#0ea5e9' },
  { name: 'Facial', value: 26, revenue: 31200, color: '#8b5cf6' },
  { name: 'Body', value: 18, revenue: 21400, color: '#10b981' },
  { name: 'Nails', value: 12, revenue: 13600, color: '#f59e0b' },
  { name: 'Wellness', value: 6, revenue: 7900, color: '#ec4899' },
];

export const TOP_SERVICES = [
  { id: 'ts-001', name: 'Swedish Massage', category: 'Massage', bookings: 142, revenue: 39760, growth: 12.4 },
  { id: 'ts-002', name: 'Hot Stone Therapy', category: 'Massage', bookings: 98, revenue: 41160, growth: 8.7 },
  { id: 'ts-003', name: 'Hydrating Facial', category: 'Facial', bookings: 124, revenue: 27280, growth: -3.2 },
  { id: 'ts-004', name: 'Anti-Aging Facial', category: 'Facial', bookings: 87, revenue: 30450, growth: 15.1 },
  { id: 'ts-005', name: 'Body Scrub & Herbal Wrap', category: 'Body', bookings: 76, revenue: 24320, growth: 5.9 },
  { id: 'ts-006', name: 'Moroccan Royal Bath', category: 'Body', bookings: 93, revenue: 23250, growth: 2.1 },
  { id: 'ts-007', name: 'Deluxe Manicure & Pedicure', category: 'Nails', bookings: 118, revenue: 21240, growth: -1.8 },
];

export const TOP_CUSTOMERS = [
  { id: 'tc-001', name: 'Dalal Al-Rasheed', phone: '+966 50 678 9012', visits: 24, totalSpend: 9840, lastVisit: '2026-08-27', branch: 'Serenity Al Nakheel — Jeddah' },
  { id: 'tc-002', name: 'Layla Al-Saud', phone: '+966 50 123 4567', visits: 19, totalSpend: 7420, lastVisit: '2026-08-27', branch: 'Serenity Al Olaya — Riyadh' },
  { id: 'tc-003', name: 'Mariam Al-Dosari', phone: '+966 55 234 5678', visits: 17, totalSpend: 6380, lastVisit: '2026-08-27', branch: 'Serenity Al Olaya — Riyadh' },
  { id: 'tc-004', name: 'Noura Al-Qahtani', phone: '+966 54 345 6789', visits: 15, totalSpend: 5700, lastVisit: '2026-08-25', branch: 'Serenity Al Olaya — Riyadh' },
  { id: 'tc-005', name: 'Shahad Al-Otaibi', phone: '+966 55 789 0123', visits: 14, totalSpend: 5180, lastVisit: '2026-08-20', branch: 'Serenity Corniche — Jeddah' },
  { id: 'tc-006', name: 'Hessa Al-Shehri', phone: '+966 59 567 8901', visits: 12, totalSpend: 4320, lastVisit: '2026-08-27', branch: 'Serenity King Fahd Road — Riyadh' },
  { id: 'tc-007', name: 'Wafa Al-Harbi', phone: '+966 50 123 9876', visits: 11, totalSpend: 3960, lastVisit: '2026-08-24', branch: 'Serenity King Fahd Road — Riyadh' },
];

export const CALENDAR_HEAT_DATA: Record<string, number> = {
  '2026-08-01': 12, '2026-08-02': 8, '2026-08-03': 6, '2026-08-04': 15,
  '2026-08-05': 18, '2026-08-06': 20, '2026-08-07': 22, '2026-08-08': 17,
  '2026-08-09': 11, '2026-08-10': 9, '2026-08-11': 21, '2026-08-12': 19,
  '2026-08-13': 24, '2026-08-14': 23, '2026-08-15': 16, '2026-08-16': 13,
  '2026-08-17': 10, '2026-08-18': 20, '2026-08-19': 25, '2026-08-20': 22,
  '2026-08-21': 18, '2026-08-22': 27, '2026-08-23': 24, '2026-08-24': 21,
  '2026-08-25': 17, '2026-08-26': 15, '2026-08-27': 12,
};

export function generateDemoUpcomingAppointments(baseDate: Date = new Date()): Appointment[] {
  const t1 = new Date(baseDate.getTime() + 45 * 60 * 1000);
  const t2 = new Date(baseDate.getTime() + 110 * 60 * 1000);
  const t3 = new Date(baseDate.getTime() + 180 * 60 * 1000);
  const t4 = new Date(baseDate.getTime() + 270 * 60 * 1000);
  const t5 = new Date(baseDate.getTime() + 360 * 60 * 1000);

  return [
    {
      id: 'demo-app-1',
      customer_id: 'tc-001',
      service_id: 'ts-001',
      staff_id: 'st-001',
      branch_id: 'br-001',
      start_time: t1.toISOString(),
      duration_min: 60,
      price: 280,
      status: 'confirmed',
      payment_method: 'card',
      notes: null,
      created_at: baseDate.toISOString(),
      customer: { id: 'tc-001', name: 'Dalal Al-Rasheed', phone: '+966 50 678 9012', email: null, gender: 'female' },
      service: { id: 'ts-001', name: 'Swedish Massage', category: 'Massage', duration_min: 60, price: 280 },
      branch: { id: 'br-001', name: 'Salmiya Spa', city: 'Salmiya', address: null, phone: null, color: '#0d9488', open_time: '09:00', close_time: '21:00' },
    },
    {
      id: 'demo-app-2',
      customer_id: 'tc-002',
      service_id: 'ts-002',
      staff_id: 'st-002',
      branch_id: 'br-001',
      start_time: t2.toISOString(),
      duration_min: 90,
      price: 420,
      status: 'confirmed',
      payment_method: 'cash',
      notes: null,
      created_at: baseDate.toISOString(),
      customer: { id: 'tc-002', name: 'Layla Al-Saud', phone: '+966 50 123 4567', email: null, gender: 'female' },
      service: { id: 'ts-002', name: 'Hot Stone Therapy', category: 'Massage', duration_min: 90, price: 420 },
      branch: { id: 'br-001', name: 'Salmiya Spa', city: 'Salmiya', address: null, phone: null, color: '#0d9488', open_time: '09:00', close_time: '21:00' },
    },
    {
      id: 'demo-app-3',
      customer_id: 'tc-003',
      service_id: 'ts-003',
      staff_id: 'st-003',
      branch_id: 'br-002',
      start_time: t3.toISOString(),
      duration_min: 45,
      price: 220,
      status: 'pending',
      payment_method: 'card',
      notes: null,
      created_at: baseDate.toISOString(),
      customer: { id: 'tc-003', name: 'Mariam Al-Dosari', phone: '+966 55 234 5678', email: null, gender: 'female' },
      service: { id: 'ts-003', name: 'Hydrating Facial', category: 'Facial', duration_min: 45, price: 220 },
      branch: { id: 'br-002', name: 'Hawally Spa', city: 'Hawally', address: null, phone: null, color: '#8b5cf6', open_time: '09:00', close_time: '21:00' },
    },
    {
      id: 'demo-app-4',
      customer_id: 'tc-004',
      service_id: 'ts-004',
      staff_id: 'st-004',
      branch_id: 'br-001',
      start_time: t4.toISOString(),
      duration_min: 60,
      price: 350,
      status: 'confirmed',
      payment_method: 'card',
      notes: null,
      created_at: baseDate.toISOString(),
      customer: { id: 'tc-004', name: 'Noura Al-Qahtani', phone: '+966 54 345 6789', email: null, gender: 'female' },
      service: { id: 'ts-004', name: 'Anti-Aging Facial', category: 'Facial', duration_min: 60, price: 350 },
      branch: { id: 'br-001', name: 'Salmiya Spa', city: 'Salmiya', address: null, phone: null, color: '#0d9488', open_time: '09:00', close_time: '21:00' },
    },
    {
      id: 'demo-app-5',
      customer_id: 'tc-005',
      service_id: 'ts-007',
      staff_id: 'st-005',
      branch_id: 'br-003',
      start_time: t5.toISOString(),
      duration_min: 45,
      price: 180,
      status: 'pending',
      payment_method: 'cash',
      notes: null,
      created_at: baseDate.toISOString(),
      customer: { id: 'tc-005', name: 'Shahad Al-Otaibi', phone: '+966 55 789 0123', email: null, gender: 'female' },
      service: { id: 'ts-007', name: 'Deluxe Manicure', category: 'Nails', duration_min: 45, price: 180 },
      branch: { id: 'br-003', name: 'Kuwait City Spa', city: 'Kuwait City', address: null, phone: null, color: '#f59e0b', open_time: '09:00', close_time: '21:00' },
    },
  ];
}

