import type { Appointment, Branch, Service, Staff, Customer } from '@/lib/supabase';
import { addDays, toISODate } from '@/lib/helpers';

export interface LegacyBranch {
  id: string;
  name: string;
  openTime: string;  // "HH:MM" 24h
  closeTime: string; // "HH:MM" 24h
  slotDuration: 30 | 60; // minutes
}

// ── Branches (Serenity Spa Centers in KSA) ──────────────────────────────────
export const DEMO_BRANCHES: Branch[] = [
  {
    id: 'branch-001',
    name: 'Serenity Al Olaya — Riyadh',
    city: 'Riyadh',
    address: 'Olaya Towers, Olaya St, Riyadh',
    phone: '+966 11 465 1234',
    color: '#0ea5e9',
    open_time: '09:00',
    close_time: '22:00',
  },
  {
    id: 'branch-002',
    name: 'Serenity King Fahd Road — Riyadh',
    city: 'Riyadh',
    address: 'King Fahd Rd, Al Sahafah, Riyadh',
    phone: '+966 11 200 5678',
    color: '#8b5cf6',
    open_time: '09:00',
    close_time: '22:00',
  },
  {
    id: 'branch-003',
    name: 'Serenity Al Nakheel — Jeddah',
    city: 'Jeddah',
    address: 'Prince Sultan St, Al Nakheel, Jeddah',
    phone: '+966 12 690 9012',
    color: '#10b981',
    open_time: '10:00',
    close_time: '22:00',
  },
  {
    id: 'branch-004',
    name: 'Serenity Corniche — Jeddah',
    city: 'Jeddah',
    address: 'Corniche Commercial Center, Al Shati, Jeddah',
    phone: '+966 12 606 3456',
    color: '#f59e0b',
    open_time: '10:00',
    close_time: '23:00',
  },
  {
    id: 'branch-005',
    name: 'Serenity Al Hamra — Khobar',
    city: 'Khobar',
    address: 'King Faisal Rd, Al Hamra, Khobar',
    phone: '+966 13 881 7890',
    color: '#ec4899',
    open_time: '09:00',
    close_time: '21:00',
  },
];

export const BRANCHES: LegacyBranch[] = DEMO_BRANCHES.map((b) => ({
  id: b.id,
  name: b.name,
  openTime: b.open_time ?? '09:00',
  closeTime: b.close_time ?? '21:00',
  slotDuration: 60,
}));

// ── Services ───────────────────────────────────────────────────────────────
export const DEMO_SERVICES: Service[] = [
  { id: 'svc-001', name: 'Swedish Massage', category: 'Massage', duration_min: 60, price: 280 },
  { id: 'svc-002', name: 'Deep Tissue Massage', category: 'Massage', duration_min: 90, price: 380 },
  { id: 'svc-003', name: 'Hot Stone Therapy', category: 'Massage', duration_min: 75, price: 420 },
  { id: 'svc-004', name: 'Aromatherapy Session', category: 'Massage', duration_min: 60, price: 300 },
  { id: 'svc-005', name: 'Hydrating Facial', category: 'Facial', duration_min: 60, price: 220 },
  { id: 'svc-006', name: 'Anti-Aging Facial', category: 'Facial', duration_min: 90, price: 350 },
  { id: 'svc-007', name: 'Gold Glow Radiance Facial', category: 'Facial', duration_min: 75, price: 450 },
  { id: 'svc-008', name: 'Moroccan Royal Bath', category: 'Body', duration_min: 60, price: 250 },
  { id: 'svc-009', name: 'Body Scrub & Herbal Wrap', category: 'Body', duration_min: 90, price: 320 },
  { id: 'svc-010', name: 'Deluxe Manicure & Pedicure', category: 'Nails', duration_min: 75, price: 180 },
  { id: 'svc-011', name: 'Gel Nail Art & Polish', category: 'Nails', duration_min: 60, price: 150 },
  { id: 'svc-012', name: 'Herbal Scalp & Hair Treatment', category: 'Wellness', duration_min: 60, price: 240 },
];

export const SERVICES = DEMO_SERVICES.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  duration: s.duration_min,
  price: s.price,
}));

// ── Staff / Therapists ─────────────────────────────────────────────────────
export const DEMO_STAFF: Staff[] = [
  { id: 'staff-001', name: 'Nour Al-Rashidi', role: 'Senior Massage Specialist', branch_id: 'branch-001' },
  { id: 'staff-002', name: 'Hana Khalid', role: 'Esthetician & Facial Expert', branch_id: 'branch-001' },
  { id: 'staff-003', name: 'Sara Al-Mutairi', role: 'Nail Artist & Technician', branch_id: 'branch-001' },
  { id: 'staff-004', name: 'Reem Faisal', role: 'Body & Hamam Therapist', branch_id: 'branch-002' },
  { id: 'staff-005', name: 'Lina Al-Zahrani', role: 'Lead Massage Therapist', branch_id: 'branch-002' },
  { id: 'staff-006', name: 'Kholoud Al-Bishi', role: 'Esthetician', branch_id: 'branch-002' },
  { id: 'staff-007', name: 'Dima Hassan', role: 'Skin Care & Facial Specialist', branch_id: 'branch-003' },
  { id: 'staff-008', name: 'Maha Al-Otaibi', role: 'Moroccan Bath Specialist', branch_id: 'branch-003' },
  { id: 'staff-009', name: 'Fatima Al-Ghamdi', role: 'Master Esthetician', branch_id: 'branch-004' },
  { id: 'staff-010', name: 'Yasmin Al-Harbi', role: 'Nail & Spa Technician', branch_id: 'branch-004' },
  { id: 'staff-011', name: 'Amani Al-Khaldi', role: 'Holistic Wellness Therapist', branch_id: 'branch-005' },
  { id: 'staff-012', name: 'Rania Al-Sayed', role: 'Massage Therapist', branch_id: 'branch-005' },
];

export const THERAPISTS = DEMO_STAFF.map((s) => ({
  id: s.id,
  name: s.name,
  branch: s.branch_id,
}));

// ── Customers ──────────────────────────────────────────────────────────────
export const DEMO_CUSTOMERS: Customer[] = [
  { id: 'cust-001', name: 'Layla Al-Saud', phone: '+966 50 123 4567', email: 'layla.saud@example.com', gender: 'Female' },
  { id: 'cust-002', name: 'Mariam Al-Dosari', phone: '+966 55 234 5678', email: 'mariam.dosari@example.com', gender: 'Female' },
  { id: 'cust-003', name: 'Noura Al-Qahtani', phone: '+966 54 345 6789', email: 'noura.qahtani@example.com', gender: 'Female' },
  { id: 'cust-004', name: 'Ruba Al-Hamdan', phone: '+966 56 456 7890', email: 'ruba.hamdan@example.com', gender: 'Female' },
  { id: 'cust-005', name: 'Hessa Al-Shehri', phone: '+966 59 567 8901', email: 'hessa.shehri@example.com', gender: 'Female' },
  { id: 'cust-006', name: 'Dalal Al-Rasheed', phone: '+966 50 678 9012', email: 'dalal.rasheed@example.com', gender: 'Female' },
  { id: 'cust-007', name: 'Shahad Al-Otaibi', phone: '+966 55 789 0123', email: 'shahad.otaibi@example.com', gender: 'Female' },
  { id: 'cust-008', name: 'Abeer Al-Maliki', phone: '+966 54 890 1234', email: 'abeer.maliki@example.com', gender: 'Female' },
  { id: 'cust-009', name: 'Ghada Al-Anazi', phone: '+966 56 901 2345', email: 'ghada.anazi@example.com', gender: 'Female' },
  { id: 'cust-010', name: 'Rana Al-Subai', phone: '+966 59 012 3456', email: 'rana.subai@example.com', gender: 'Female' },
  { id: 'cust-011', name: 'Wafa Al-Harbi', phone: '+966 50 123 9876', email: 'wafa.harbi@example.com', gender: 'Female' },
  { id: 'cust-012', name: 'Nada Al-Bishi', phone: '+966 55 456 1234', email: 'nada.bishi@example.com', gender: 'Female' },
  { id: 'cust-013', name: 'Reem Al-Zamil', phone: '+966 53 789 4561', email: 'reem.zamil@example.com', gender: 'Female' },
  { id: 'cust-014', name: 'Jana Al-Husseini', phone: '+966 57 890 2345', email: 'jana.husseini@example.com', gender: 'Female' },
  { id: 'cust-015', name: 'Sultan Al-Otaibi', phone: '+966 50 999 1122', email: 'sultan.otaibi@example.com', gender: 'Male' },
  { id: 'cust-016', name: 'Khalid Al-Ghamdi', phone: '+966 55 888 3344', email: 'khalid.ghamdi@example.com', gender: 'Male' },
  { id: 'cust-017', name: 'Fahad Al-Mutlaq', phone: '+966 54 777 5566', email: 'fahad.mutlaq@example.com', gender: 'Male' },
  { id: 'cust-018', name: 'Mona Al-Khatib', phone: '+966 56 666 7788', email: 'mona.khatib@example.com', gender: 'Female' },
  { id: 'cust-019', name: 'Sarah Al-Mansoor', phone: '+966 59 555 9900', email: 'sarah.mansoor@example.com', gender: 'Female' },
  { id: 'cust-020', name: 'Lulwa Al-Thunayan', phone: '+966 50 444 2233', email: 'lulwa.thunayan@example.com', gender: 'Female' },
];

export const MOCK_CUSTOMERS = DEMO_CUSTOMERS;

// ── Dynamic Demo Appointments Generator ────────────────────────────────────
export function generateDemoAppointments(): Appointment[] {
  const now = new Date();
  const appointments: Appointment[] = [];

  const branchMap = new Map(DEMO_BRANCHES.map((b) => [b.id, b]));
  const serviceMap = new Map(DEMO_SERVICES.map((s) => [s.id, s]));
  const staffMap = new Map(DEMO_STAFF.map((st) => [st.id, st]));
  const custMap = new Map(DEMO_CUSTOMERS.map((c) => [c.id, c]));

  // Helper to build single joined appointment
  let counter = 1;
  const createAppt = (
    dateStr: string,
    timeStr: string,
    branchId: string,
    serviceId: string,
    staffId: string,
    customerId: string,
    status: Appointment['status'],
    paymentMethod: string = 'card',
    notes: string = ''
  ): Appointment => {
    const id = `appt-${String(counter++).padStart(4, '0')}`;
    const startTime = `${dateStr}T${timeStr}:00`;
    const service = serviceMap.get(serviceId)!;
    const branch = branchMap.get(branchId)!;
    const staff = staffMap.get(staffId)!;
    const customer = custMap.get(customerId)!;

    return {
      id,
      customer_id: customerId,
      service_id: serviceId,
      staff_id: staffId,
      branch_id: branchId,
      start_time: startTime,
      duration_min: service?.duration_min ?? 60,
      price: service?.price ?? 250,
      status,
      payment_method: paymentMethod,
      notes,
      created_at: new Date(new Date(startTime).getTime() - 86400000 * 2).toISOString(),
      branch,
      service,
      staff,
      customer,
    };
  };

  // 1. TODAY's Appointments (Detailed multi-branch schedule)
  const todayStr = toISODate(now);

  appointments.push(
    createAppt(todayStr, '09:00', 'branch-001', 'svc-001', 'staff-001', 'cust-001', 'confirmed', 'card', 'Prefers light pressure'),
    createAppt(todayStr, '10:00', 'branch-001', 'svc-005', 'staff-002', 'cust-002', 'confirmed', 'apple_pay', 'Sensitive skin'),
    createAppt(todayStr, '11:00', 'branch-001', 'svc-002', 'staff-001', 'cust-003', 'pending', 'card', 'First-time customer'),
    createAppt(todayStr, '13:00', 'branch-001', 'svc-008', 'staff-002', 'cust-009', 'completed', 'cash', 'VIP guest'),
    createAppt(todayStr, '15:00', 'branch-001', 'svc-011', 'staff-003', 'cust-010', 'completed', 'card', ''),
    createAppt(todayStr, '17:00', 'branch-001', 'svc-005', 'staff-002', 'cust-012', 'pending', 'card', 'Monthly routine'),
    createAppt(todayStr, '18:30', 'branch-001', 'svc-003', 'staff-001', 'cust-006', 'confirmed', 'card', 'Warm stone preference'),

    createAppt(todayStr, '09:30', 'branch-002', 'svc-009', 'staff-004', 'cust-004', 'completed', 'card', ''),
    createAppt(todayStr, '11:30', 'branch-002', 'svc-010', 'staff-006', 'cust-005', 'completed', 'apple_pay', ''),
    createAppt(todayStr, '14:00', 'branch-002', 'svc-001', 'staff-005', 'cust-011', 'confirmed', 'cash', ''),
    createAppt(todayStr, '16:00', 'branch-002', 'svc-006', 'staff-006', 'cust-013', 'pending', 'card', 'Focus on hydration'),
    createAppt(todayStr, '19:00', 'branch-002', 'svc-003', 'staff-005', 'cust-015', 'confirmed', 'card', ''),

    createAppt(todayStr, '10:30', 'branch-003', 'svc-003', 'staff-007', 'cust-006', 'completed', 'card', 'VIP Suite requested'),
    createAppt(todayStr, '13:00', 'branch-003', 'svc-008', 'staff-008', 'cust-014', 'confirmed', 'card', ''),
    createAppt(todayStr, '15:30', 'branch-003', 'svc-007', 'staff-007', 'cust-019', 'pending', 'apple_pay', 'Bridal package session'),
    createAppt(todayStr, '18:00', 'branch-003', 'svc-002', 'staff-008', 'cust-016', 'confirmed', 'card', ''),

    createAppt(todayStr, '11:00', 'branch-004', 'svc-006', 'staff-009', 'cust-007', 'cancelled', 'card', 'Customer requested reschedule'),
    createAppt(todayStr, '14:00', 'branch-004', 'svc-010', 'staff-010', 'cust-018', 'confirmed', 'card', ''),
    createAppt(todayStr, '17:00', 'branch-004', 'svc-004', 'staff-009', 'cust-020', 'confirmed', 'apple_pay', 'Lavender scent preferred'),
    createAppt(todayStr, '20:00', 'branch-004', 'svc-001', 'staff-010', 'cust-017', 'pending', 'cash', ''),

    createAppt(todayStr, '10:00', 'branch-005', 'svc-004', 'staff-011', 'cust-008', 'pending', 'card', 'Allergic to eucalyptus'),
    createAppt(todayStr, '13:30', 'branch-005', 'svc-012', 'staff-011', 'cust-019', 'completed', 'card', ''),
    createAppt(todayStr, '16:00', 'branch-005', 'svc-002', 'staff-012', 'cust-015', 'confirmed', 'card', '')
  );

  // 2. Schedule for Past 45 Days (Provides seamless trends, charts, monthly stats)
  const timeslots = ['09:00', '10:15', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00', '20:15'];
  const branchIds = DEMO_BRANCHES.map((b) => b.id);
  const serviceIds = DEMO_SERVICES.map((s) => s.id);
  const customerIds = DEMO_CUSTOMERS.map((c) => c.id);

  for (let d = 1; d <= 45; d++) {
    const pastDate = addDays(now, -d);
    const dateStr = toISODate(pastDate);
    // 4 to 8 bookings per past day for realistic volume & earnings
    const daySeed = (d * 7 + 13) % 5 + 4;

    for (let s = 0; s < daySeed; s++) {
      const bIdx = (d + s) % branchIds.length;
      const branchId = branchIds[bIdx];
      const branchStaffList = DEMO_STAFF.filter((st) => st.branch_id === branchId);
      const staff = branchStaffList[s % branchStaffList.length] || DEMO_STAFF[0];
      const serviceId = serviceIds[(d * 3 + s * 2) % serviceIds.length];
      const customerId = customerIds[(d * 2 + s * 5) % customerIds.length];
      const time = timeslots[s % timeslots.length];

      // Realistic historical statuses
      let status: Appointment['status'] = 'completed';
      if ((d + s) % 11 === 0) status = 'cancelled';
      else if ((d + s) % 17 === 0) status = 'no_show';
      else if (d <= 2 && (s % 4 === 0)) status = 'confirmed';

      appointments.push(
        createAppt(
          dateStr,
          time,
          branchId,
          serviceId,
          staff.id,
          customerId,
          status,
          (s % 3 === 0) ? 'apple_pay' : (s % 3 === 1 ? 'card' : 'cash'),
          ''
        )
      );
    }
  }

  // 3. Schedule for Upcoming 14 Days (Provides forward-looking calendar & weekly metrics)
  for (let d = 1; d <= 14; d++) {
    const futureDate = addDays(now, d);
    const dateStr = toISODate(futureDate);
    const daySeed = (d * 5 + 7) % 4 + 4;

    for (let s = 0; s < daySeed; s++) {
      const bIdx = (d + s) % branchIds.length;
      const branchId = branchIds[bIdx];
      const branchStaffList = DEMO_STAFF.filter((st) => st.branch_id === branchId);
      const staff = branchStaffList[s % branchStaffList.length] || DEMO_STAFF[0];
      const serviceId = serviceIds[(d + s * 3) % serviceIds.length];
      const customerId = customerIds[(d * 3 + s) % customerIds.length];
      const time = timeslots[s % timeslots.length];
      const status: Appointment['status'] = (s % 3 === 0) ? 'pending' : 'confirmed';

      appointments.push(
        createAppt(
          dateStr,
          time,
          branchId,
          serviceId,
          staff.id,
          customerId,
          status,
          'card',
          'Advance booking'
        )
      );
    }
  }

  // Sort by start_time ascending
  return appointments.sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
}

export const DEMO_APPOINTMENTS: Appointment[] = generateDemoAppointments();
export const MOCK_APPOINTMENTS = DEMO_APPOINTMENTS;

export const MOCK_USERS = [
  {
    id: 'usr-001',
    name: 'Arwa Al-Shalaan',
    email: 'admin@spacenter.sa',
    password: 'Admin@2026',
    role: 'admin' as const,
    branchId: null,
    branchName: null,
    avatar: 'AS',
  },
  {
    id: 'usr-002',
    name: 'Mona Al-Fawzan',
    email: 'manager@spacenter.sa',
    password: 'Manager@2026',
    role: 'branch_manager' as const,
    branchId: 'branch-001',
    branchName: 'Serenity Al Olaya — Riyadh',
    avatar: 'MF',
  },
  {
    id: 'usr-003',
    name: 'Nour Al-Rashidi',
    email: 'staff@spacenter.sa',
    password: 'Staff@2026',
    role: 'staff' as const,
    branchId: 'branch-001',
    branchName: 'Serenity Al Olaya — Riyadh',
    avatar: 'NR',
  },
];

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

/** Generate time slots for a branch on a given date */
export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  slotDuration: 30 | 60,
  date: string,
  appointments: Appointment[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const dateIsoPrefix = date.slice(0, 10);

  // Build a map of booked time ranges
  const bookedRanges = appointments
    .filter((a) => {
      const aDate = toISODate(new Date(a.start_time));
      return aDate === dateIsoPrefix && a.status !== 'cancelled' && a.status !== 'no_show';
    })
    .map((a) => {
      const d = new Date(a.start_time);
      const start = d.getHours() * 60 + d.getMinutes();
      return { start, end: start + a.duration_min, appointment: a };
    });

  let current = openMinutes;
  while (current + slotDuration <= closeMinutes) {
    const slotEnd = current + slotDuration;
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    const timeLabel = `${hh}:${mm}`;

    const bookedAppt = bookedRanges.find(
      (r) => r.start >= current && r.start < slotEnd
    );

    const continuationAppt = bookedRanges.find(
      (r) => r.start < current && r.end > current
    );

    if (bookedAppt) {
      const slotsSpanned = Math.ceil(bookedAppt.appointment.duration_min / slotDuration);
      slots.push({
        time: timeLabel,
        status: 'booked',
        appointment: bookedAppt.appointment,
        slotsSpanned,
        isContinuation: false,
      });
    } else if (continuationAppt) {
      slots.push({
        time: timeLabel,
        status: 'continuation',
        appointment: continuationAppt.appointment,
        slotsSpanned: 1,
        isContinuation: true,
      });
    } else {
      slots.push({
        time: timeLabel,
        status: 'available',
        appointment: null,
        slotsSpanned: 1,
        isContinuation: false,
      });
    }

    current += slotDuration;
  }

  return slots;
}

export interface TimeSlot {
  time: string;
  status: 'available' | 'booked' | 'continuation';
  appointment: Appointment | null;
  slotsSpanned: number;
  isContinuation: boolean;
}
