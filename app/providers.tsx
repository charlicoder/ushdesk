'use client';

import { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { store } from '@/store';
import { initAuthFromStorage, logout, setToken } from '@/store/slices/authSlice';
import { getSessionRemainingMs, clearToken } from '@/lib/api';

// ─── Public routes (no auth required) ───────────────────────────────────────
const PUBLIC_ROUTES = ['/login'];

// ─── Theme / locale sync ─────────────────────────────────────────────────────
function DirSync() {
  const locale = useAppSelector((s) => s.ui.locale);
  const theme  = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir  = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }, [theme]);

  return null;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const dispatch     = useAppDispatch();
  const router       = useRouter();
  const pathname     = usePathname();
  const { user, initialized } = useAppSelector((s) => s.auth);

  // Ref to hold the auto-expire timer so we can clear it on unmount/re-check
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On first mount: hydrate auth state from localStorage
  useEffect(() => {
    dispatch(initAuthFromStorage());
  }, [dispatch]);

  // Listen for silent token-refresh events from authedFetch
  useEffect(() => {
    const onRefreshed = (e: Event) => {
      const token = (e as CustomEvent<{ token: string }>).detail?.token;
      if (token) dispatch(setToken(token));
    };
    window.addEventListener('ush:token-refreshed', onRefreshed);
    return () => {
      window.removeEventListener('ush:token-refreshed', onRefreshed);
    };
  }, [dispatch]);

  // After initialization, redirect based on auth state
  useEffect(() => {
    if (!initialized) return;

    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

    if (!user && !isPublic) {
      router.replace('/login');
    } else if (user && isPublic) {
      router.replace('/');
    }
  }, [initialized, user, pathname, router]);

  // ── Session expiry: check on every route change and set a precise timer ──
  useEffect(() => {
    // Clear any existing expire timer
    if (expireTimerRef.current) {
      clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }

    if (!user) return; // not logged in, nothing to expire

    const remaining = getSessionRemainingMs();

    if (remaining <= 0) {
      // Already expired — clean up storage then log out
      clearToken();
      dispatch(logout());
      router.replace('/login');
      return;
    }

    // Schedule precise auto-logout at the exact moment the 12-hour window closes
    expireTimerRef.current = setTimeout(() => {
      clearToken(); // clean up storage before Redux logout
      dispatch(logout());
      router.replace('/login');
    }, remaining);

    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    };
  // Re-run whenever the user or pathname changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname]);

  // While hydrating, show nothing (prevents flash)
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

// ─── Providers ────────────────────────────────────────────────────────────────
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <DirSync />
      <AuthGuard>{children}</AuthGuard>
    </Provider>
  );
}
