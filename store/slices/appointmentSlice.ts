import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AppointmentStatus =
  | 'available' |'pending' |'confirmed' |'in_progress' |'completed' |'cancelled' |'no_show';

export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  service: string;
  serviceCategory: string;
  therapist: string;
  branch: string;
  branchId: string;
  room: string;
  date: string;
  timeSlot: string;
  duration: number;
  price: number;
  status: AppointmentStatus;
  notes: string;
}

interface AppointmentState {
  appointments: Appointment[];
  selectedBranch: string;
  selectedDate: string;
  viewMode: 'list' | 'calendar';
  statusFilter: AppointmentStatus | 'all';
}

const initialState: AppointmentState = {
  appointments: [],
  selectedBranch: 'all',
  selectedDate: '',
  viewMode: 'list',
  statusFilter: 'all',
};

const appointmentSlice = createSlice({
  name: 'appointments',
  initialState,
  reducers: {
    setAppointments(state, action: PayloadAction<Appointment[]>) {
      state.appointments = action.payload;
    },
    updateAppointmentStatus(
      state,
      action: PayloadAction<{ id: string; status: AppointmentStatus }>
    ) {
      const appt = state.appointments.find((a) => a.id === action.payload.id);
      if (appt) appt.status = action.payload.status;
    },
    setSelectedBranch(state, action: PayloadAction<string>) {
      state.selectedBranch = action.payload;
    },
    setSelectedDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload;
    },
    setViewMode(state, action: PayloadAction<'list' | 'calendar'>) {
      state.viewMode = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<AppointmentStatus | 'all'>) {
      state.statusFilter = action.payload;
    },
  },
});

export const {
  setAppointments,
  updateAppointmentStatus,
  setSelectedBranch,
  setSelectedDate,
  setViewMode,
  setStatusFilter,
} = appointmentSlice.actions;
export default appointmentSlice.reducer;
