import { Appointment } from '@/store/slices/appointmentSlice';


export interface Branch {
  id: string;
  name: string;
  openTime: string;  // "HH:MM" 24h
  closeTime: string; // "HH:MM" 24h
  slotDuration: 30 | 60; // minutes
}

export const BRANCHES: Branch[] = [
  { id: 'branch-001', name: 'Al Olaya — Riyadh',       openTime: '09:00', closeTime: '21:00', slotDuration: 60 },
  { id: 'branch-002', name: 'King Fahd Road — Riyadh', openTime: '09:00', closeTime: '22:00', slotDuration: 60 },
  { id: 'branch-003', name: 'Al Nakheel — Jeddah',     openTime: '10:00', closeTime: '22:00', slotDuration: 60 },
  { id: 'branch-004', name: 'Corniche — Jeddah',       openTime: '10:00', closeTime: '23:00', slotDuration: 30 },
  { id: 'branch-005', name: 'Al Hamra — Khobar',       openTime: '09:00', closeTime: '21:00', slotDuration: 30 },
];

export interface Service {
  id: string;
  name: string;
  category: string;
  duration: number; // minutes
  price: number;
}

export const SERVICES: Service[] = [
  { id: 'svc-001', name: 'Swedish Massage',    category: 'Massage',  duration: 60,  price: 280 },
  { id: 'svc-002', name: 'Deep Tissue Massage',category: 'Massage',  duration: 90,  price: 380 },
  { id: 'svc-003', name: 'Hot Stone Therapy',  category: 'Massage',  duration: 75,  price: 420 },
  { id: 'svc-004', name: 'Hydrating Facial',   category: 'Facial',   duration: 60,  price: 220 },
  { id: 'svc-005', name: 'Anti-Aging Facial',  category: 'Facial',   duration: 90,  price: 350 },
  { id: 'svc-006', name: 'Body Scrub & Wrap',  category: 'Body',     duration: 90,  price: 320 },
  { id: 'svc-007', name: 'Moroccan Bath',      category: 'Body',     duration: 60,  price: 250 },
  { id: 'svc-008', name: 'Manicure & Pedicure',category: 'Nails',    duration: 75,  price: 180 },
  { id: 'svc-009', name: 'Gel Nail Art',       category: 'Nails',    duration: 60,  price: 150 },
  { id: 'svc-010', name: 'Aromatherapy Session',category: 'Wellness',duration: 60,  price: 300 },
];

export const THERAPISTS = [
  { id: 'th-001', name: 'Nour Al-Rashidi',   branch: 'branch-001' },
  { id: 'th-002', name: 'Hana Khalid',        branch: 'branch-001' },
  { id: 'th-003', name: 'Sara Al-Mutairi',    branch: 'branch-001' },
  { id: 'th-004', name: 'Reem Faisal',        branch: 'branch-002' },
  { id: 'th-005', name: 'Lina Al-Zahrani',    branch: 'branch-002' },
  { id: 'th-006', name: 'Dima Hassan',        branch: 'branch-003' },
  { id: 'th-007', name: 'Maha Al-Otaibi',     branch: 'branch-004' },
  { id: 'th-008', name: 'Fatima Al-Ghamdi',   branch: 'branch-005' },
];

export const MOCK_CUSTOMERS = [
  { id: 'cust-001', name: 'Layla Al-Saud',      phone: '+966 50 123 4567', email: 'layla@example.com' },
  { id: 'cust-002', name: 'Mariam Al-Dosari',   phone: '+966 55 234 5678', email: 'mariam@example.com' },
  { id: 'cust-003', name: 'Noura Al-Qahtani',   phone: '+966 54 345 6789', email: 'noura@example.com' },
  { id: 'cust-004', name: 'Ruba Al-Hamdan',     phone: '+966 56 456 7890', email: 'ruba@example.com' },
  { id: 'cust-005', name: 'Hessa Al-Shehri',    phone: '+966 59 567 8901', email: 'hessa@example.com' },
  { id: 'cust-006', name: 'Dalal Al-Rasheed',   phone: '+966 50 678 9012', email: 'dalal@example.com' },
  { id: 'cust-007', name: 'Shahad Al-Otaibi',   phone: '+966 55 789 0123', email: 'shahad@example.com' },
  { id: 'cust-008', name: 'Abeer Al-Maliki',    phone: '+966 54 890 1234', email: 'abeer@example.com' },
  { id: 'cust-009', name: 'Ghada Al-Anazi',     phone: '+966 56 901 2345', email: 'ghada@example.com' },
  { id: 'cust-010', name: 'Rana Al-Subai',      phone: '+966 59 012 3456', email: 'rana@example.com' },
  { id: 'cust-011', name: 'Wafa Al-Harbi',      phone: '+966 50 123 9876', email: 'wafa@example.com' },
  { id: 'cust-012', name: 'Nada Al-Bishi',      phone: '+966 55 456 1234', email: 'nada@example.com' },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-001', customerName: 'Layla Al-Saud', customerPhone: '+966 50 123 4567',
    service: 'Swedish Massage', serviceCategory: 'Massage', therapist: 'Nour Al-Rashidi',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 3',
    date: '2026-07-27', timeSlot: '09:00', duration: 60, price: 280, status: 'confirmed',
    notes: 'Prefers light pressure',
  },
  {
    id: 'appt-002', customerName: 'Mariam Al-Dosari', customerPhone: '+966 55 234 5678',
    service: 'Hydrating Facial', serviceCategory: 'Facial', therapist: 'Hana Khalid',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 1',
    date: '2026-07-27', timeSlot: '10:00', duration: 60, price: 220, status: 'in_progress',
    notes: '',
  },
  {
    id: 'appt-003', customerName: 'Noura Al-Qahtani', customerPhone: '+966 54 345 6789',
    service: 'Deep Tissue Massage', serviceCategory: 'Massage', therapist: 'Sara Al-Mutairi',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 5',
    date: '2026-07-27', timeSlot: '11:00', duration: 90, price: 380, status: 'pending',
    notes: 'First-time customer',
  },
  {
    id: 'appt-004', customerName: 'Ruba Al-Hamdan', customerPhone: '+966 56 456 7890',
    service: 'Body Scrub & Wrap', serviceCategory: 'Body', therapist: 'Reem Faisal',
    branch: 'King Fahd Road — Riyadh', branchId: 'branch-002', room: 'Room 2',
    date: '2026-07-27', timeSlot: '11:00', duration: 90, price: 320, status: 'confirmed',
    notes: '',
  },
  {
    id: 'appt-005', customerName: 'Hessa Al-Shehri', customerPhone: '+966 59 567 8901',
    service: 'Manicure & Pedicure', serviceCategory: 'Nails', therapist: 'Lina Al-Zahrani',
    branch: 'King Fahd Road — Riyadh', branchId: 'branch-002', room: 'Nail Studio',
    date: '2026-07-27', timeSlot: '12:00', duration: 75, price: 180, status: 'completed',
    notes: '',
  },
  {
    id: 'appt-006', customerName: 'Dalal Al-Rasheed', customerPhone: '+966 50 678 9012',
    service: 'Hot Stone Therapy', serviceCategory: 'Massage', therapist: 'Dima Hassan',
    branch: 'Al Nakheel — Jeddah', branchId: 'branch-003', room: 'VIP Suite',
    date: '2026-07-27', timeSlot: '13:00', duration: 75, price: 420, status: 'confirmed',
    notes: 'VIP client — priority service',
  },
  {
    id: 'appt-007', customerName: 'Shahad Al-Otaibi', customerPhone: '+966 55 789 0123',
    service: 'Anti-Aging Facial', serviceCategory: 'Facial', therapist: 'Maha Al-Otaibi',
    branch: 'Corniche — Jeddah', branchId: 'branch-004', room: 'Room 2',
    date: '2026-07-27', timeSlot: '14:00', duration: 90, price: 350, status: 'cancelled',
    notes: 'Customer requested cancellation',
  },
  {
    id: 'appt-008', customerName: 'Abeer Al-Maliki', customerPhone: '+966 54 890 1234',
    service: 'Aromatherapy Session', serviceCategory: 'Wellness', therapist: 'Fatima Al-Ghamdi',
    branch: 'Al Hamra — Khobar', branchId: 'branch-005', room: 'Wellness Room',
    date: '2026-07-27', timeSlot: '14:00', duration: 60, price: 300, status: 'pending',
    notes: 'Allergic to lavender',
  },
  {
    id: 'appt-009', customerName: 'Ghada Al-Anazi', customerPhone: '+966 56 901 2345',
    service: 'Moroccan Bath', serviceCategory: 'Body', therapist: 'Nour Al-Rashidi',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Hammam Suite',
    date: '2026-07-27', timeSlot: '15:00', duration: 60, price: 250, status: 'confirmed',
    notes: '',
  },
  {
    id: 'appt-010', customerName: 'Rana Al-Subai', customerPhone: '+966 59 012 3456',
    service: 'Gel Nail Art', serviceCategory: 'Nails', therapist: 'Hana Khalid',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Nail Studio',
    date: '2026-07-27', timeSlot: '15:00', duration: 60, price: 150, status: 'no_show',
    notes: 'No response to reminder call',
  },
  {
    id: 'appt-011', customerName: 'Wafa Al-Harbi', customerPhone: '+966 50 123 9876',
    service: 'Swedish Massage', serviceCategory: 'Massage', therapist: 'Lina Al-Zahrani',
    branch: 'King Fahd Road — Riyadh', branchId: 'branch-002', room: 'Room 4',
    date: '2026-07-27', timeSlot: '16:00', duration: 60, price: 280, status: 'confirmed',
    notes: '',
  },
  {
    id: 'appt-012', customerName: 'Nada Al-Bishi', customerPhone: '+966 55 456 1234',
    service: 'Hydrating Facial', serviceCategory: 'Facial', therapist: 'Sara Al-Mutairi',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 1',
    date: '2026-07-27', timeSlot: '17:00', duration: 60, price: 220, status: 'pending',
    notes: 'Recurring monthly appointment',
  },
  // Additional appointments for other dates
  {
    id: 'appt-013', customerName: 'Layla Al-Saud', customerPhone: '+966 50 123 4567',
    service: 'Hot Stone Therapy', serviceCategory: 'Massage', therapist: 'Nour Al-Rashidi',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 3',
    date: '2026-07-28', timeSlot: '10:00', duration: 75, price: 420, status: 'confirmed',
    notes: '',
  },
  {
    id: 'appt-014', customerName: 'Mariam Al-Dosari', customerPhone: '+966 55 234 5678',
    service: 'Body Scrub & Wrap', serviceCategory: 'Body', therapist: 'Hana Khalid',
    branch: 'Al Olaya — Riyadh', branchId: 'branch-001', room: 'Room 2',
    date: '2026-07-28', timeSlot: '13:00', duration: 90, price: 320, status: 'pending',
    notes: '',
  },
  {
    id: 'appt-015', customerName: 'Dalal Al-Rasheed', customerPhone: '+966 50 678 9012',
    service: 'Anti-Aging Facial', serviceCategory: 'Facial', therapist: 'Dima Hassan',
    branch: 'Al Nakheel — Jeddah', branchId: 'branch-003', room: 'VIP Suite',
    date: '2026-07-26', timeSlot: '11:00', duration: 90, price: 350, status: 'completed',
    notes: '',
  },
  {
    id: 'appt-016', customerName: 'Hessa Al-Shehri', customerPhone: '+966 59 567 8901',
    service: 'Swedish Massage', serviceCategory: 'Massage', therapist: 'Lina Al-Zahrani',
    branch: 'King Fahd Road — Riyadh', branchId: 'branch-002', room: 'Room 1',
    date: '2026-07-26', timeSlot: '14:00', duration: 60, price: 280, status: 'completed',
    notes: '',
  },
];

export const MOCK_USERS = [
  {
    id: 'usr-001', name: 'Arwa Al-Shalaan', email: 'admin@spacenter.sa',
    password: 'Admin@2026', role: 'admin' as const, branchId: null, branchName: null,
    avatar: 'AS',
  },
  {
    id: 'usr-002', name: 'Mona Al-Fawzan', email: 'manager@spacenter.sa',
    password: 'Manager@2026', role: 'branch_manager' as const,
    branchId: 'branch-001', branchName: 'Al Olaya — Riyadh', avatar: 'MF',
  },
  {
    id: 'usr-003', name: 'Nour Al-Rashidi', email: 'staff@spacenter.sa',
    password: 'Staff@2026', role: 'staff' as const,
    branchId: 'branch-001', branchName: 'Al Olaya — Riyadh', avatar: 'NR',
  },
];

// Revenue trend — 30 days ending today
export const REVENUE_TREND = [
  { date: '06/27', revenue: 4200, bookings: 14 },
  { date: '06/28', revenue: 3800, bookings: 12 },
  { date: '06/29', revenue: 5100, bookings: 17 },
  { date: '06/30', revenue: 6200, bookings: 21 },
  { date: '07/01', revenue: 4800, bookings: 16 },
  { date: '07/02', revenue: 3200, bookings: 11 },
  { date: '07/03', revenue: 2900, bookings: 9 },
  { date: '07/04', revenue: 5400, bookings: 18 },
  { date: '07/05', revenue: 5900, bookings: 20 },
  { date: '07/06', revenue: 6700, bookings: 22 },
  { date: '07/07', revenue: 7100, bookings: 24 },
  { date: '07/08', revenue: 5600, bookings: 19 },
  { date: '07/09', revenue: 4100, bookings: 14 },
  { date: '07/10', revenue: 3700, bookings: 12 },
  { date: '07/11', revenue: 6300, bookings: 21 },
  { date: '07/12', revenue: 5800, bookings: 19 },
  { date: '07/13', revenue: 7400, bookings: 25 },
  { date: '07/14', revenue: 6900, bookings: 23 },
  { date: '07/15', revenue: 5200, bookings: 17 },
  { date: '07/16', revenue: 4600, bookings: 15 },
  { date: '07/17', revenue: 3900, bookings: 13 },
  { date: '07/18', revenue: 6100, bookings: 20 },
  { date: '07/19', revenue: 7200, bookings: 24 },
  { date: '07/20', revenue: 6800, bookings: 23 },
  { date: '07/21', revenue: 5700, bookings: 19 },
  { date: '07/22', revenue: 8100, bookings: 27 },
  { date: '07/23', revenue: 7600, bookings: 25 },
  { date: '07/24', revenue: 6400, bookings: 21 },
  { date: '07/25', revenue: 5300, bookings: 18 },
  { date: '07/26', revenue: 4700, bookings: 16 },
  { date: '07/27', revenue: 3800, bookings: 12 },
];

export const HOURLY_BOOKINGS = [
  { hour: '08:00', bookings: 3 },
  { hour: '09:00', bookings: 8 },
  { hour: '10:00', bookings: 14 },
  { hour: '11:00', bookings: 18 },
  { hour: '12:00', bookings: 16 },
  { hour: '13:00', bookings: 11 },
  { hour: '14:00', bookings: 19 },
  { hour: '15:00', bookings: 21 },
  { hour: '16:00', bookings: 17 },
  { hour: '17:00', bookings: 13 },
  { hour: '18:00', bookings: 9 },
  { hour: '19:00', bookings: 6 },
  { hour: '20:00', bookings: 4 },
];

export const SERVICE_CATEGORY_DATA = [
  { name: 'Massage', value: 38, revenue: 42800, color: '#c9797a' },
  { name: 'Facial', value: 24, revenue: 27200, color: '#e8b4a0' },
  { name: 'Body', value: 19, revenue: 21400, color: '#d4a0a0' },
  { name: 'Nails', value: 12, revenue: 13600, color: '#f0d0c8' },
  { name: 'Wellness', value: 7, revenue: 7900, color: '#a85d5e' },
];

export const TOP_SERVICES = [
  { id: 'ts-001', name: 'Swedish Massage', category: 'Massage', bookings: 142, revenue: 39760, growth: 12.4 },
  { id: 'ts-002', name: 'Hot Stone Therapy', category: 'Massage', bookings: 98, revenue: 41160, growth: 8.7 },
  { id: 'ts-003', name: 'Hydrating Facial', category: 'Facial', bookings: 124, revenue: 27280, growth: -3.2 },
  { id: 'ts-004', name: 'Anti-Aging Facial', category: 'Facial', bookings: 87, revenue: 30450, growth: 15.1 },
  { id: 'ts-005', name: 'Body Scrub & Wrap', category: 'Body', bookings: 76, revenue: 24320, growth: 5.9 },
  { id: 'ts-006', name: 'Moroccan Bath', category: 'Body', bookings: 93, revenue: 23250, growth: 2.1 },
  { id: 'ts-007', name: 'Manicure & Pedicure', category: 'Nails', bookings: 118, revenue: 21240, growth: -1.8 },
];

export const TOP_CUSTOMERS = [
  { id: 'tc-001', name: 'Dalal Al-Rasheed', phone: '+966 50 678 9012', visits: 24, totalSpend: 9840, lastVisit: '2026-07-27', branch: 'Al Nakheel — Jeddah' },
  { id: 'tc-002', name: 'Layla Al-Saud', phone: '+966 50 123 4567', visits: 19, totalSpend: 7420, lastVisit: '2026-07-27', branch: 'Al Olaya — Riyadh' },
  { id: 'tc-003', name: 'Mariam Al-Dosari', phone: '+966 55 234 5678', visits: 17, totalSpend: 6380, lastVisit: '2026-07-27', branch: 'Al Olaya — Riyadh' },
  { id: 'tc-004', name: 'Noura Al-Qahtani', phone: '+966 54 345 6789', visits: 15, totalSpend: 5700, lastVisit: '2026-07-25', branch: 'Al Olaya — Riyadh' },
  { id: 'tc-005', name: 'Shahad Al-Otaibi', phone: '+966 55 789 0123', visits: 14, totalSpend: 5180, lastVisit: '2026-07-20', branch: 'Corniche — Jeddah' },
  { id: 'tc-006', name: 'Hessa Al-Shehri', phone: '+966 59 567 8901', visits: 12, totalSpend: 4320, lastVisit: '2026-07-27', branch: 'King Fahd Road — Riyadh' },
  { id: 'tc-007', name: 'Wafa Al-Harbi', phone: '+966 50 123 9876', visits: 11, totalSpend: 3960, lastVisit: '2026-07-24', branch: 'King Fahd Road — Riyadh' },
];

export const CALENDAR_HEAT_DATA: Record<string, number> = {
  '2026-07-01': 12, '2026-07-02': 8, '2026-07-03': 6, '2026-07-04': 15,
  '2026-07-05': 18, '2026-07-06': 20, '2026-07-07': 22, '2026-07-08': 17,
  '2026-07-09': 11, '2026-07-10': 9, '2026-07-11': 21, '2026-07-12': 19,
  '2026-07-13': 24, '2026-07-14': 23, '2026-07-15': 16, '2026-07-16': 13,
  '2026-07-17': 10, '2026-07-18': 20, '2026-07-19': 25, '2026-07-20': 22,
  '2026-07-21': 18, '2026-07-22': 27, '2026-07-23': 24, '2026-07-24': 21,
  '2026-07-25': 17, '2026-07-26': 15, '2026-07-27': 12,
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

  // Build a map of booked time ranges
  const bookedRanges = appointments
    .filter((a) => a.date === date && a.status !== 'cancelled' && a.status !== 'no_show')
    .map((a) => {
      const [h, m] = a.timeSlot.split(':').map(Number);
      const start = h * 60 + m;
      return { start, end: start + a.duration, appointment: a };
    });

  let current = openMinutes;
  while (current + slotDuration <= closeMinutes) {
    const slotEnd = current + slotDuration;
    const hh = String(Math.floor(current / 60)).padStart(2, '0');
    const mm = String(current % 60).padStart(2, '0');
    const timeLabel = `${hh}:${mm}`;

    // Find if any appointment starts in this slot
    const bookedAppt = bookedRanges.find(
      (r) => r.start >= current && r.start < slotEnd
    );

    // Check if this slot is continuation of a multi-slot booking
    const continuationAppt = bookedRanges.find(
      (r) => r.start < current && r.end > current
    );

    if (bookedAppt) {
      const slotsSpanned = Math.ceil(bookedAppt.appointment.duration / slotDuration);
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
