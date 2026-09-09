import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Appointment, Branch, Service, Staff, Customer } from '@/types/appointment';

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

export const updateAppointmentStatus = createAsyncThunk(
  'data/updateAppointmentStatus',
  async ({ id, status }: { id: string; status: Appointment['status'] }) => {
    return { id, status };
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
    const state = (getState() as { data: DataState }).data;
    const branch = state.branches.find((b) => b.id === input.branch_id);
    const service = state.services.find((s) => s.id === input.service_id);
    const staff = state.staff.find((st) => st.id === input.staff_id);
    const customer = state.customers.find((c) => c.id === input.customer_id);

    const newAppt: Appointment = {
      id: `appt-${Date.now()}`,
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
  },
);

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
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

export default dataSlice.reducer;
