import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  saveToken,
  saveUser,
  clearToken,
  getToken,
  loadUser,
} from '@/lib/api';
import { isCustomerType, ALLOWED_USER_TYPES } from '@/lib/permissions';

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

/** Role/permission metadata returned by the API under data.permissions */
export interface AuthRoleInfo {
  role_id?: string | null;
  role_name?: string | null;
  role_description?: string | null;
  is_superuser: boolean;
  is_branch_manager: boolean;
  is_therapist_role: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  /** Permission codenames, e.g. ["deskmenu.appointments", "appointments.view"] */
  permissions: string[];
  /** Role metadata from data.permissions */
  roleInfo: AuthRoleInfo | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  permissions: [],
  roleInfo: null,
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

      // Block customer-type users with a friendly warning
      if (userType && isCustomerType(userType)) {
        return rejectWithValue(
          'Access denied. Customer accounts cannot log in to the USH Desk portal. This system is for employees and administrators only.',
        );
      }

      // Block any other non-allowed user type
      if (userType && !ALLOWED_USER_TYPES.includes(userType.toLowerCase() as typeof ALLOWED_USER_TYPES[number])) {
        return rejectWithValue('Access denied. Only USH Spa employees can log in here.');
      }

      // ─────────────────────────────────────────────────────────────────────
      // Parse permissions from the API response.
      //
      // Actual API structure:
      //   response.data.permissions.codenames  ← array of permission strings
      //   response.data.permissions.role_name  ← role metadata
      //   response.data.permissions.is_superuser
      // ─────────────────────────────────────────────────────────────────────
      const rawPermBlock = payload_data.permissions as Record<string, unknown> | undefined;

      // codenames is the canonical source; fall back to legacy locations just in case
      const codenamesRaw =
        (rawPermBlock?.codenames as string[] | undefined) ??
        (rawUser.permissions as string[] | undefined) ??
        (rawUser.user_permissions as string[] | undefined) ??
        [];

      const permissions: string[] = Array.isArray(codenamesRaw)
        ? codenamesRaw.filter((p) => typeof p === 'string')
        : [];

      const roleInfo: AuthRoleInfo = {
        role_id:          (rawPermBlock?.role_id          as string  | undefined) ?? null,
        role_name:        (rawPermBlock?.role_name        as string  | undefined) ?? null,
        role_description: (rawPermBlock?.role_description as string  | undefined) ?? null,
        is_superuser:     (rawPermBlock?.is_superuser     as boolean | undefined) ?? false,
        is_branch_manager:(rawPermBlock?.is_branch_manager as boolean | undefined) ?? false,
        is_therapist_role:(rawPermBlock?.is_therapist_role as boolean | undefined) ?? false,
      };

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
      saveUser({ ...user as unknown as Record<string, unknown>, permissions, roleInfo });

      return { user, token, permissions, roleInfo };
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
    const raw   = loadUser() as (AuthUser & { permissions?: string[]; roleInfo?: AuthRoleInfo }) | null;
    // Extract permissions and roleInfo separately from the stored user blob
    const { permissions: storedPerms, roleInfo: storedRole, ...userFields } = raw ?? {};
    const user        = raw ? (userFields as AuthUser) : null;
    const permissions = Array.isArray(storedPerms) ? storedPerms : [];
    const roleInfo    = storedRole ?? null;
    return { token, user, permissions, roleInfo };
  },
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user        = null;
      state.token       = null;
      state.permissions = [];
      state.roleInfo    = null;
      state.status      = 'idle';
      state.error       = null;
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
        state.status      = 'succeeded';
        state.user        = action.payload.user;
        state.token       = action.payload.token;
        state.permissions = action.payload.permissions;
        state.roleInfo    = action.payload.roleInfo;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error  = action.payload as string;
      })

      // ── init from storage ──
      .addCase(initAuthFromStorage.fulfilled, (state, action) => {
        state.initialized = true;
        if (action.payload.token && action.payload.user) {
          state.token       = action.payload.token;
          state.user        = action.payload.user;
          state.permissions = action.payload.permissions;
          state.roleInfo    = action.payload.roleInfo;
          state.status      = 'succeeded';
        }
      });
  },
});

export const { logout, clearError, setToken } = authSlice.actions;
export default authSlice.reducer;
