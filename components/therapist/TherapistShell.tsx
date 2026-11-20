'use client';

import { LogOut, Moon, Sun, Sparkles, CalendarDays } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleTheme } from '@/store/slices/uiSlice';
import { logout } from '@/store/slices/authSlice';
import { isDualRoleTherapist } from '@/lib/permissions';

/**
 * Minimal layout for the therapist portal.
 * For dual-role therapists (e.g. Therapist + Branch Manager / Therapists Manager),
 * displays a role badge and navigation button to switch to the branch schedule.
 */
export function TherapistShell({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);
  const theme = useAppSelector((s) => s.ui.theme);
  const isDualRole = isDualRoleTherapist(roleInfo, user);

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
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">My Appointments</p>
                {isDualRole && (
                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {roleInfo?.is_branch_manager ? 'Branch Manager' : 'Therapists Manager'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{user?.name || 'Therapist'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isDualRole && (
              <button
                onClick={() => router.push('/appointments/therapist-schedule')}
                className="flex h-10 items-center gap-2 rounded-xl bg-primary text-primary-foreground px-3.5 text-xs sm:text-sm font-semibold shadow-sm transition hover:bg-primary/90"
                title="Switch to Branch Schedule (All Therapists)"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">All Therapists Schedule</span>
                <span className="sm:hidden">All Schedule</span>
              </button>
            )}
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

