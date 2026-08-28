'use client';

import { Menu, Moon, Sun, Languages, Bell, Search, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/hooks/use-i18n';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleSidebar, toggleTheme, toggleLocale } from '@/store/slices/uiSlice';
import { setSearch } from '@/store/slices/filtersSlice';
import { logout } from '@/store/slices/authSlice';

export function Topbar() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const theme    = useAppSelector((s) => s.ui.theme);
  const search   = useAppSelector((s) => s.filters.search);
  const user     = useAppSelector((s) => s.auth.user);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/login');
  };

  /** Initials from full name */
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-30 glass border-b border-border/50">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          className="grid h-10 w-10 place-items-center rounded-xl bg-muted/60 transition hover:bg-muted"
          onClick={() => dispatch(toggleSidebar())}
          aria-label={t('menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* search */}
        <div className="relative hidden flex-1 sm:block">
          <Search className="pointer-events-none absolute ltr:left-3 rtl:right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => dispatch(setSearch(e.target.value))}
            placeholder={t('search')}
            className="h-10 w-full max-w-md rounded-xl border border-border bg-card/60 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
          {/* language toggle */}
          <button
            onClick={() => dispatch(toggleLocale())}
            className="flex h-10 items-center gap-2 rounded-xl bg-muted/60 px-3 text-sm font-semibold transition hover:bg-muted"
            aria-label={t('language')}
          >
            <Languages className="h-4 w-4" />
            <span>{locale === 'en' ? 'ع' : 'EN'}</span>
          </button>

          {/* theme toggle */}
          <button
            onClick={() => dispatch(toggleTheme())}
            className="relative grid h-10 w-10 place-items-center rounded-xl bg-muted/60 transition hover:bg-muted"
            aria-label={t('theme')}
          >
            <span className="relative h-5 w-5">
              <Sun className={theme === 'light' ? 'h-5 w-5 rotate-0 scale-100 transition-all' : 'absolute inset-0 h-5 w-5 rotate-90 scale-0 transition-all'} />
              <Moon className={theme === 'dark' ? 'h-5 w-5 rotate-0 scale-100 transition-all' : 'absolute inset-0 h-5 w-5 -rotate-90 scale-0 transition-all'} />
            </span>
          </button>

          {/* notifications */}
          <button
            className="relative grid h-10 w-10 place-items-center rounded-xl bg-muted/60 transition hover:bg-muted"
            aria-label={t('notifications')}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
          </button>

          {/* user avatar + name */}
          <div className="flex items-center gap-2.5 rounded-xl bg-muted/60 p-1.5 pr-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-bold text-white">
              {initials}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold leading-tight">{user?.name ?? 'Employee'}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{user?.user_type ?? 'Staff'}</p>
            </div>
          </div>

          {/* logout */}
          <button
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-xl bg-muted/60 transition hover:bg-destructive/10 hover:text-destructive"
            aria-label="Logout"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
