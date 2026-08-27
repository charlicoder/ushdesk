import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Locale } from '@/lib/i18n';

export interface UiState {
  locale: Locale;
  language: 'en' | 'ar';
  direction: 'ltr' | 'rtl';
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

const initialState: UiState = {
  locale: 'en',
  language: 'en',
  direction: 'ltr',
  theme: 'light',
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
    },
    toggleLocale(state) {
      state.locale = state.locale === 'en' ? 'ar' : 'en';
    },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
    },
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const {
  setLocale,
  toggleLocale,
  setTheme,
  toggleTheme,
  setSidebarOpen,
  toggleSidebar,
} = uiSlice.actions;
export default uiSlice.reducer;
