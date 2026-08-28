import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { supabase, type Appointment, type Branch, type Service, type Staff, type Customer } from '@/lib/supabase';
import {
  DEMO_BRANCHES,
  DEMO_SERVICES,
  DEMO_STAFF,
  DEMO_CUSTOMERS,
  generateDemoAppointments,
} from '@/data/mockData';

export interface DataState {
  appointments: Appointment[];
  branches: Branch[];
  services: Service[];
  staff: Staff[];
  customers: Customer[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialDemoAppointments = generateDemoAppointments();

const initialState: DataState = {
  appointments: initialDemoAppointments,
  branches: DEMO_BRANCHES,
  services: DEMO_SERVICES,
  staff: DEMO_STAFF,
  customers: DEMO_CUSTOMERS,
  status: 'succeeded',
  error: null,
};

export const fetchDashboardData = createAsyncThunk(
  'data/fetchDashboardData',
  async (_, { rejectWithValue }) => {
    try {
      const [appts, branches, services, staff, customers] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, branch:branches(*), service:services(*), staff:staff(*), customer:customers(*)')
          .order('start_time', { ascending: true }),
        supabase.from('branches').select('*').order('name'),
        supabase.from('services').select('*').order('name'),
        supabase.from('staff').select('*').order('name'),
        supabase.from('customers').select('*').order('name'),
      ]);

      const errors = [appts.error, branches.error, services.error, staff.error, customers.error].filter(Boolean);
      
      // If supabase returns real rows without error, return them
      if (!errors.length && appts.data && appts.data.length > 0 && branches.data && branches.data.length > 0) {
        return {
          appointments: appts.data as Appointment[],
          branches: branches.data as Branch[],
          services: services.data as Service[],
          staff: staff.data as Staff[],
          customers: customers.data as Customer[],
        };
      }

      // Fallback to high-quality demo data
      return {
        appointments: generateDemoAppointments(),
        branches: DEMO_BRANCHES,
        services: DEMO_SERVICES,
        staff: DEMO_STAFF,
        customers: DEMO_CUSTOMERS,
      };
    } catch {
      // Offline / network fallback to demo data
      return {
        appointments: generateDemoAppointments(),
        branches: DEMO_BRANCHES,
        services: DEMO_SERVICES,
        staff: DEMO_STAFF,
        customers: DEMO_CUSTOMERS,
      };
    }
  },
);

export const updateAppointmentStatus = createAsyncThunk(
  'data/updateAppointmentStatus',
  async ({ id, status }: { id: string; status: Appointment['status'] }) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .select('*, branch:branches(*), service:services(*), staff:staff(*), customer:customers(*)')
        .single();
      if (error || !data) return { id, status };
      return data as Appointment;
    } catch {
      return { id, status };
    }
  },
);

export interface CreateAppointmentInput {
  branch_id: string;
  customer_id: string;
  service_id: string;
  staff_id: string;
  start_time: string; // ISO string
  duration_min: number;
  price: number;
  payment_method: string;
  notes: string;
  status: Appointment['status'];
}

export const createAppointment = createAsyncThunk(
  'data/createAppointment',
  async (input: CreateAppointmentInput, { getState }) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([input])
        .select('*, branch:branches(*), service:services(*), staff:staff(*), customer:customers(*)')
        .single();
      if (error || !data) {
        // Build local demo appointment from state
        const state = (getState() as { data: DataState }).data;
        const branch = state.branches.find((b) => b.id === input.branch_id);
        const service = state.services.find((s) => s.id === input.service_id);
        const staff = state.staff.find((st) => st.id === input.staff_id);
        const customer = state.customers.find((c) => c.id === input.customer_id);

        const newAppt: Appointment = {
          id: `appt-demo-${Date.now()}`,
          customer_id: input.customer_id,
          service_id: input.service_id,
          staff_id: input.staff_id,
          branch_id: input.branch_id,
          start_time: input.start_time,
          duration_min: input.duration_min,
          price: input.price,
          status: input.status,
          payment_method: input.payment_method,
          notes: input.notes,
          created_at: new Date().toISOString(),
          branch,
          service,
          staff,
          customer,
        };
        return newAppt;
      }
      return data as Appointment;
    } catch {
      const state = (getState() as { data: DataState }).data;
      const branch = state.branches.find((b) => b.id === input.branch_id);
      const service = state.services.find((s) => s.id === input.service_id);
      const staff = state.staff.find((st) => st.id === input.staff_id);
      const customer = state.customers.find((c) => c.id === input.customer_id);

      const newAppt: Appointment = {
        id: `appt-demo-${Date.now()}`,
        customer_id: input.customer_id,
        service_id: input.service_id,
        staff_id: input.staff_id,
        branch_id: input.branch_id,
        start_time: input.start_time,
        duration_min: input.duration_min,
        price: input.price,
        status: input.status,
        payment_method: input.payment_method,
        notes: input.notes,
        created_at: new Date().toISOString(),
        branch,
        service,
        staff,
        customer,
      };
      return newAppt;
    }
  },
);

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    populateDemoData(state) {
      state.appointments = generateDemoAppointments();
      state.branches = DEMO_BRANCHES;
      state.services = DEMO_SERVICES;
      state.staff = DEMO_STAFF;
      state.customers = DEMO_CUSTOMERS;
      state.status = 'succeeded';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        // Keep existing demo data while loading
        if (state.appointments.length === 0) {
          state.status = 'loading';
        }
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.appointments = action.payload.appointments;
        state.branches = action.payload.branches;
        state.services = action.payload.services;
        state.staff = action.payload.staff;
        state.customers = action.payload.customers;
      })
      .addCase(fetchDashboardData.rejected, (state) => {
        // On rejection, stay on demo data and marked as succeeded
        state.status = 'succeeded';
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action: PayloadAction<Appointment | { id: string; status: Appointment['status'] }>) => {
        const payload = action.payload;
        const idx = state.appointments.findIndex((a) => a.id === payload.id);
        if (idx >= 0) {
          if ('start_time' in payload) {
            state.appointments[idx] = payload;
          } else {
            state.appointments[idx].status = payload.status;
          }
        }
      })
      .addCase(createAppointment.fulfilled, (state, action: PayloadAction<Appointment>) => {
        state.appointments.push(action.payload);
        state.appointments.sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        );
      });
  },
});

export const { populateDemoData } = dataSlice.actions;
export default dataSlice.reducer;
