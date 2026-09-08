'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { setLocale, setTheme } from '@/store/slices/uiSlice';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { Languages, Moon, Sun, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);

  return (
    <DashboardShell>
      <PageHeader title={t('navSettings')} subtitle="Manage your dashboard preferences." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title={t('language')} subtitle="Choose your preferred language">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => dispatch(setLocale('en'))}
              className={cn('flex items-center gap-3 rounded-xl border p-4 transition', locale === 'en' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/40')}
            >
              <Languages className="h-6 w-6 text-primary" />
              <div className="flex-1 text-left">
                <p className="font-semibold">English</p>
                <p className="text-xs text-muted-foreground">LTR</p>
              </div>
              {locale === 'en' && <Check className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => dispatch(setLocale('ar'))}
              className={cn('flex items-center gap-3 rounded-xl border p-4 transition', locale === 'ar' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/40')}
            >
              <Languages className="h-6 w-6 text-primary" />
              <div className="flex-1 text-left">
                <p className="font-semibold">العربية</p>
                <p className="text-xs text-muted-foreground">RTL</p>
              </div>
              {locale === 'ar' && <Check className="h-5 w-5 text-primary" />}
            </button>
          </div>
        </SectionCard>

        <SectionCard title={t('theme')} subtitle="Switch between light and dark mode">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => dispatch(setTheme('light'))}
              className={cn('flex items-center gap-3 rounded-xl border p-4 transition', theme === 'light' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/40')}
            >
              <Sun className="h-6 w-6 text-amber-500" />
              <div className="flex-1 text-left">
                <p className="font-semibold">{t('light')}</p>
              </div>
              {theme === 'light' && <Check className="h-5 w-5 text-primary" />}
            </button>
            <button
              onClick={() => dispatch(setTheme('dark'))}
              className={cn('flex items-center gap-3 rounded-xl border p-4 transition', theme === 'dark' ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:bg-muted/40')}
            >
              <Moon className="h-6 w-6 text-indigo-400" />
              <div className="flex-1 text-left">
                <p className="font-semibold">{t('dark')}</p>
              </div>
              {theme === 'dark' && <Check className="h-5 w-5 text-primary" />}
            </button>
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
