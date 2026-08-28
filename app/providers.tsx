'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { usePathname, useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { store } from '@/store';
import { initAuthFromStorage } from '@/store/slices/authSlice';

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

  // On first mount: hydrate auth state from localStorage
  useEffect(() => {
    dispatch(initAuthFromStorage());
  }, [dispatch]);

  // After initialization, redirect based on auth state
  useEffect(() => {
    if (!initialized) return;

    const isPublic = PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

    if (!user && !isPublic) {
      // Not logged in → go to login
      router.replace('/login');
    } else if (user && isPublic) {
      // Already logged in → go to dashboard
      router.replace('/');
    }
  }, [initialized, user, pathname, router]);

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
