import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  saveToken,
  saveUser,
  clearToken,
  getToken,
  loadUser,
} from '@/lib/api';

/** Proxy URL — Next.js API route avoids browser CORS issues */
const PROXY_LOGIN = '/api/v1/auth/login';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string | number;
  name: string;
  phone_number: string;
  email?: string | null;
  user_type: string;
  avatar?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
  initialized: false,
};

// ─── Login Thunk ──────────────────────────────────────────────────────────────

export interface LoginPayload {
  phone_number: string;
  password: string;
}

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (payload: LoginPayload, { rejectWithValue }) => {
    try {
      const res = await fetch(PROXY_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: Record<string, unknown> = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Extract real error from backend response (various formats)
        const errData = (data.data ?? data) as Record<string, unknown>;
        const msg =
          (data.detail as string) ??
          (data.message as string) ??
          (errData.detail as string) ??
          (errData.message as string) ??
          ((data.non_field_errors as string[]) ?? [])[0] ??
          ((data.phone_number as string[]) ?? [])[0] ??
          `Login failed (${res.status})`;
        return rejectWithValue(msg);
      }

      // ── Parse response: { success, data: { access_token, refresh_token, user } } ──
      const payload_data = (data.data ?? data) as Record<string, unknown>;

      // Token lives in data.access_token
      const token =
        (payload_data.access_token as string) ??
        (payload_data.access as string) ??
        (payload_data.token as string) ??
        (data.access_token as string) ??
        '';

      // Refresh token (store for later use)
      const refreshToken =
        (payload_data.refresh_token as string) ??
        (payload_data.refresh as string) ??
        null;

      if (refreshToken && typeof window !== 'undefined') {
        localStorage.setItem('ush_refresh_token', refreshToken);
      }

      // User is nested under data.user
      const rawUser =
        (payload_data.user as Record<string, unknown>) ??
        (data.user as Record<string, unknown>) ??
        (payload_data as Record<string, unknown>);

      // Build full name from first_name + last_name
      const firstName = (rawUser.first_name ?? '') as string;
      const lastName  = (rawUser.last_name  ?? '') as string;
      const combined  = [firstName, lastName].filter(Boolean).join(' ');
      const fullName  = combined ||
        ((rawUser.name as string | undefined) ??
         (rawUser.username as string | undefined) ??
         'User');

      const userType: string =
        ((rawUser.user_type ?? rawUser.type ?? rawUser.role) as string) ?? '';

      // Only allow employees
      if (userType && !['employee', 'staff', 'manager', 'admin', 'branch_manager'].includes(userType.toLowerCase())) {
        return rejectWithValue('Access denied. Only employees can log in here.');
      }

      const user: AuthUser = {
        id: (rawUser.id ?? rawUser.pk ?? '') as string,
        name: fullName,
        phone_number: (rawUser.phone_number ?? payload.phone_number) as string,
        email: (rawUser.email ?? null) as string | null,
        user_type: userType || 'employee',
        avatar: (rawUser.avatar ?? null) as string | null,
        branch_id: (rawUser.branch_id ?? rawUser.branch ?? null) as string | null,
        branch_name: (rawUser.branch_name ?? null) as string | null,
      };

      saveToken(token);
      saveUser(user as unknown as Record<string, unknown>);

      return { user, token };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return rejectWithValue(msg);
    }
  },
);

// ─── Init From Storage Thunk ──────────────────────────────────────────────────

export const initAuthFromStorage = createAsyncThunk(
  'auth/initFromStorage',
  async () => {
    const token = getToken();
    const user  = loadUser() as AuthUser | null;
    return { token, user };
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user  = null;
      state.token = null;
      state.status = 'idle';
      state.error  = null;
      clearToken();
    },
    clearError(state) {
      state.error = null;
    },
    /** Called after a silent token refresh — keeps Redux in sync with localStorage. */
    setToken(state, action: { payload: string }) {
      state.token = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── login ──
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user   = action.payload.user;
        state.token  = action.payload.token;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error  = action.payload as string;
      })

      // ── init from storage ──
      .addCase(initAuthFromStorage.fulfilled, (state, action) => {
        state.initialized = true;
        if (action.payload.token && action.payload.user) {
          state.token  = action.payload.token;
          state.user   = action.payload.user;
          state.status = 'succeeded';
        }
      });
  },
});

export const { logout, clearError, setToken } = authSlice.actions;
export default authSlice.reducer;
