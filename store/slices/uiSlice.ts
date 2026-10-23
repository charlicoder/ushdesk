import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Locale } from '@/lib/i18n';

const LOCALE_STORAGE_KEY = 'ush_locale';
const THEME_STORAGE_KEY = 'ush_theme';

function loadLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === 'ar' ? 'ar' : 'en';
}

function persistLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

function loadTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' ? 'dark' : 'light';
}

function persistTheme(theme: 'light' | 'dark'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export interface UiState {
  locale: Locale;
  language: 'en' | 'ar';
  direction: 'ltr' | 'rtl';
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
}

const storedLocale = loadLocale();
const storedTheme = loadTheme();

const initialState: UiState = {
  locale: storedLocale,
  language: storedLocale,
  direction: storedLocale === 'ar' ? 'rtl' : 'ltr',
  theme: storedTheme,
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLocale(state, action: PayloadAction<Locale>) {
      state.locale = action.payload;
      state.language = action.payload;
      state.direction = action.payload === 'ar' ? 'rtl' : 'ltr';
      persistLocale(action.payload);
    },
    toggleLocale(state) {
      const next = state.locale === 'en' ? 'ar' : 'en';
      state.locale = next;
      state.language = next;
      state.direction = next === 'ar' ? 'rtl' : 'ltr';
      persistLocale(next);
    },
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
      persistTheme(action.payload);
    },
    toggleTheme(state) {
      const next = state.theme === 'light' ? 'dark' : 'light';
      state.theme = next;
      persistTheme(next);
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
