import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  color: string;
  open_time: string | null;  // "HH:MM" e.g. "09:00"
  close_time: string | null; // "HH:MM" e.g. "21:00"
}

export interface Service {
  id: string;
  name: string;
  category: string;
  duration_min: number;
  price: number;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  branch_id: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
}

export interface Appointment {
  id: string;
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  branch_id: string;
  start_time: string;
  duration_min: number;
  price: number;
  status: AppointmentStatus;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  branch?: Branch;
  service?: Service;
  staff?: Staff;
  customer?: Customer;
}
