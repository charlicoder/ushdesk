import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ViewMode = 'calendar' | 'list';
export type RangeMode = 'day' | 'week' | 'month';

export interface FiltersState {
  branchId: string | 'all';
  status: string | 'all';
  viewMode: ViewMode;
  rangeMode: RangeMode;
  search: string;
  selectedDate: string; // ISO date (yyyy-mm-dd)
}

const today = new Date().toISOString().slice(0, 10);

const initialState: FiltersState = {
  branchId: 'all',
  status: 'all',
  viewMode: 'calendar',
  rangeMode: 'month',
  search: '',
  selectedDate: today,
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setBranch(state, action: PayloadAction<string | 'all'>) {
      state.branchId = action.payload;
    },
    setStatus(state, action: PayloadAction<string | 'all'>) {
      state.status = action.payload;
    },
    setViewMode(state, action: PayloadAction<ViewMode>) {
      state.viewMode = action.payload;
    },
    setRangeMode(state, action: PayloadAction<RangeMode>) {
      state.rangeMode = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setSelectedDate(state, action: PayloadAction<string>) {
      state.selectedDate = action.payload;
    },
    resetFilters(state) {
      state.branchId = 'all';
      state.status = 'all';
      state.search = '';
    },
  },
});

export const {
  setBranch,
  setStatus,
  setViewMode,
  setRangeMode,
  setSearch,
  setSelectedDate,
  resetFilters,
} = filtersSlice.actions;
export default filtersSlice.reducer;
