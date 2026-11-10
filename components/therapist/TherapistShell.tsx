'use client';

import { LogOut, Moon, Sun, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleTheme } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';

/**
 * Minimal layout for the therapist portal: no sidebar, no navigation links —
 * only the therapist's name, a theme toggle and logout.
 */
export function TherapistShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.ui.theme);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/login');
  };

  return (
    <div className="relative min-h-screen">
      <div className="aurora" />
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-foreground">My Appointments</p>
              <p className="text-xs text-muted-foreground">{user?.name || 'Therapist'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch(toggleTheme())}
              className="grid h-10 w-10 place-items-center rounded-xl bg-muted/60 transition hover:bg-muted"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex h-10 items-center gap-2 rounded-xl bg-muted/60 px-3 text-sm font-semibold transition hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

