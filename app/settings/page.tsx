'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { setLocale, setTheme } from '@/store/slices/uiSlice';
import { populateDemoData } from '@/store/slices/dataSlice';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { Languages, Moon, Sun, Check, Sparkles } from 'lucide-react';
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
        <SectionCard title={locale === 'ar' ? 'بيانات العرض التوضيحي' : 'Demo Data'} subtitle={locale === 'ar' ? 'إعادة تعيين أو تحديث بيانات العرض التجريبية' : 'Reset or refresh dashboard demo dataset'}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-2">
            <div>
              <p className="text-sm font-semibold">{locale === 'ar' ? 'إعادة تحميل بيانات العرض التوضيحي' : 'Reload Demo Data'}</p>
              <p className="text-xs text-muted-foreground">{locale === 'ar' ? 'إعادة ضبط كافة المواعيد والفروع والخدمات والعملاء' : 'Reset all appointments, branches, services, and customers to fresh demo state.'}</p>
            </div>
            <button
              onClick={() => dispatch(populateDemoData())}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 active:scale-95"
            >
              <Sparkles className="h-4 w-4" />
              {locale === 'ar' ? 'إعادة تعيين البيانات' : 'Reload Demo Data'}
            </button>
          </div>
        </SectionCard>
      </div>
    </DashboardShell>
  );
}
