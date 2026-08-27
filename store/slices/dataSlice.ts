import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { supabase, type Appointment, type Branch, type Service, type Staff, type Customer } from '@/lib/supabase';

export interface DataState {
  appointments: Appointment[];
  branches: Branch[];
  services: Service[];
  staff: Staff[];
  customers: Customer[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: DataState = {
  appointments: [],
  branches: [],
  services: [],
  staff: [],
  customers: [],
  status: 'idle',
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
      if (errors.length) return rejectWithValue(errors[0]?.message ?? 'Failed to load data');

      return {
        appointments: appts.data as Appointment[],
        branches: branches.data as Branch[],
        services: services.data as Service[],
        staff: staff.data as Staff[],
        customers: customers.data as Customer[],
      };
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  },
);

export const updateAppointmentStatus = createAsyncThunk(
  'data/updateAppointmentStatus',
  async ({ id, status }: { id: string; status: Appointment['status'] }, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id)
        .select('*, branch:branches(*), service:services(*), staff:staff(*), customer:customers(*)')
        .single();
      if (error) return rejectWithValue(error.message);
      return data as Appointment;
    } catch (err) {
      return rejectWithValue((err as Error).message);
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
  async (input: CreateAppointmentInput, { rejectWithValue }) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .insert([input])
        .select('*, branch:branches(*), service:services(*), staff:staff(*), customer:customers(*)')
        .single();
      if (error) return rejectWithValue(error.message);
      return data as Appointment;
    } catch (err) {
      return rejectWithValue((err as Error).message);
    }
  },
);

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.status = 'loading';
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
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action: PayloadAction<Appointment>) => {
        const idx = state.appointments.findIndex((a) => a.id === action.payload.id);
        if (idx >= 0) state.appointments[idx] = action.payload;
      })
      .addCase(createAppointment.fulfilled, (state, action: PayloadAction<Appointment>) => {
        state.appointments.push(action.payload);
        state.appointments.sort(
          (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        );
      });
  },
});

export default dataSlice.reducer;
