'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  ShieldCheck,
  Clock,
  Calendar,
  Sun,
  Moon,
  Languages,
  Laptop,
  Check,
  History,
  Trash2,
  RefreshCw,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useI18n } from '@/hooks/use-i18n';
import { setLocale, setTheme } from '@/store/slices/uiSlice';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { SectionCard } from '@/components/dashboard/section-card';
import { getSessionRemainingMs, SESSION_TTL_MS } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DEFAULT_TIMEZONE as KUWAIT_TZ } from '@/lib/datetime';

interface UserHistoryItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'auth' | 'theme' | 'locale' | 'action';
  badge?: string;
}

const HISTORY_STORAGE_KEY = 'ush_user_history';
const LOGINAT_STORAGE_KEY = 'ush_login_at';

function getClientDetails(): { os: string; browser: string } {
  if (typeof window === 'undefined') {
    return { os: 'Unknown OS', browser: 'Web Browser' };
  }
  const ua = window.navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Mac') !== -1) os = 'macOS';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (ua.indexOf('Android') !== -1) os = 'Android';
  else if (ua.indexOf('like Mac') !== -1) os = 'iOS';

  let browser = 'Web Browser';
  if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
  else if (ua.indexOf('SamsungBrowser') !== -1) browser = 'Samsung Internet';
  else if (ua.indexOf('Opera') !== -1 || ua.indexOf('OPR') !== -1) browser = 'Opera';
  else if (ua.indexOf('Edge') !== -1 || ua.indexOf('Edg') !== -1) browser = 'Microsoft Edge';
  else if (ua.indexOf('Chrome') !== -1) browser = 'Google Chrome';
  else if (ua.indexOf('Safari') !== -1) browser = 'Apple Safari';

  return { os, browser };
}

function formatRemainingTime(ms: number): string {
  if (ms <= 0) return 'Expired';
  const totalMin = Math.floor(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function OverviewPage() {
  const { t, locale } = useI18n();
  const dispatch = useAppDispatch();

  const user = useAppSelector((s) => s.auth.user);
  const roleInfo = useAppSelector((s) => s.auth.roleInfo);
  const permissions = useAppSelector((s) => s.auth.permissions);
  const theme = useAppSelector((s) => s.ui.theme);

  const [mounted, setMounted] = useState(false);
  const [sessionRemaining, setSessionRemaining] = useState<number>(SESSION_TTL_MS);
  const [loginTimeStr, setLoginTimeStr] = useState<string>('—');
  const [historyList, setHistoryList] = useState<UserHistoryItem[]>([]);
  const [clientInfo, setClientInfo] = useState<{ os: string; browser: string }>({
    os: 'Unknown OS',
    browser: 'Web Browser',
  });

  // Load and sync history
  const loadHistory = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHistoryList(parsed);
          return;
        }
      }

      // If no history exists, create seed records based on current login
      const rawLoginAt = localStorage.getItem(LOGINAT_STORAGE_KEY);
      const loginDate = rawLoginAt ? new Date(Number(rawLoginAt)) : new Date();
      const loginFormatted = loginDate.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', {
        timeZone: KUWAIT_TZ,
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const initialHistory: UserHistoryItem[] = [
        {
          id: 'init-1',
          title: locale === 'ar' ? 'تسجيل دخول ناجح' : 'User Authentication',
          description:
            locale === 'ar'
              ? 'تم تسجيل الدخول إلى لوحة التحكم وتفعيل رمز الجلسة.'
              : 'Authenticated into USH Desk dashboard with active session token.',
          timestamp: loginFormatted,
          type: 'auth',
          badge: locale === 'ar' ? 'جلسة نشطة' : 'Active Session',
        },
        {
          id: 'init-2',
          title: locale === 'ar' ? 'بدء مساحة العمل' : 'Workspace Ready',
          description:
            locale === 'ar'
              ? 'تم تحميل الصلاحيات والبيانات للفرع المخصص بنجاح.'
              : 'Permissions and workspace environment loaded successfully.',
          timestamp: loginFormatted,
          type: 'action',
          badge: locale === 'ar' ? 'مكتمل' : 'Success',
        },
      ];

      setHistoryList(initialHistory);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(initialHistory));
    } catch {
      setHistoryList([]);
    }
  }, [locale]);

  const addHistoryEntry = useCallback(
    (entry: Omit<UserHistoryItem, 'id' | 'timestamp'>) => {
      if (typeof window === 'undefined') return;
      const now = new Date();
      const timestamp = now.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', {
        timeZone: KUWAIT_TZ,
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const newItem: UserHistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...entry,
        timestamp,
      };

      setHistoryList((prev) => {
        const updated = [newItem, ...prev.slice(0, 19)]; // keep latest 20 items
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore storage error
        }
        return updated;
      });
    },
    [locale]
  );

  const handleClearHistory = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    // Keep 1 clean record for current session
    const now = new Date();
    const timestamp = now.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', {
      timeZone: KUWAIT_TZ,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const resetList: UserHistoryItem[] = [
      {
        id: `hist-${Date.now()}`,
        title: locale === 'ar' ? 'تمت إعادة ضبط السجل' : 'History Cleared',
        description:
          locale === 'ar'
            ? 'تم تنظيف سجل الأنشطة والاحتفاظ بالجلسة النشطة الحالية.'
            : 'Activity history reset. Current active session maintained.',
        timestamp,
        type: 'action',
        badge: locale === 'ar' ? 'نشط' : 'Active',
      },
    ];
    setHistoryList(resetList);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(resetList));
  };

  useEffect(() => {
    setMounted(true);
    setClientInfo(getClientDetails());
    loadHistory();

    const rawLoginAt = localStorage.getItem(LOGINAT_STORAGE_KEY);
    if (rawLoginAt) {
      const loginDate = new Date(Number(rawLoginAt));
      setLoginTimeStr(
        loginDate.toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', {
          timeZone: KUWAIT_TZ,
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      );
    } else {
      setLoginTimeStr(
        new Date().toLocaleString(locale === 'ar' ? 'ar-KW' : 'en-US', {
          timeZone: KUWAIT_TZ,
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      );
    }

    setSessionRemaining(getSessionRemainingMs());
    const interval = setInterval(() => {
      setSessionRemaining(getSessionRemainingMs());
    }, 30000); // refresh remaining time every 30s

    return () => clearInterval(interval);
  }, [loadHistory, locale]);

  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }, [user?.name]);

  const roleDisplay = useMemo(() => {
    if (user?.role_name) return user.role_name;
    if (user?.role) return user.role;
    if (roleInfo?.role_name) return roleInfo.role_name;
    if (roleInfo?.is_superuser) return locale === 'ar' ? 'المشرف العام (Superuser)' : 'Super Administrator';
    if (roleInfo?.is_branch_manager) return locale === 'ar' ? 'مدير الفرع' : 'Branch Manager';
    if (roleInfo?.is_therapist_role) return locale === 'ar' ? 'أخصائية / معالجة' : 'Therapist';
    return user?.user_type === 'admin'
      ? locale === 'ar' ? 'مسؤول النظام' : 'Administrator'
      : locale === 'ar' ? 'موظف' : 'Staff Member';
  }, [user, roleInfo, locale]);

  const branchDisplay = useMemo(() => {
    if (user?.branch_name) return user.branch_name;
    if (user?.branch_id) return `Branch #${user.branch_id}`;
    if (roleInfo?.is_superuser) return locale === 'ar' ? 'جميع الفروع (الإدارة المركزية)' : 'All Branches (HQ Admin)';
    return locale === 'ar' ? 'الفرع الرئيسي' : 'Main Center';
  }, [user, roleInfo, locale]);

  const handleSelectTheme = (newTheme: 'light' | 'dark') => {
    if (newTheme === theme) return;
    dispatch(setTheme(newTheme));
    addHistoryEntry({
      title: locale === 'ar' ? 'تغيير السمة' : 'Theme Preference Changed',
      description:
        locale === 'ar'
          ? `تم تغيير مظهر الواجهة إلى الوضع ${newTheme === 'dark' ? 'الداكن' : 'الفاتح'}.`
          : `Dashboard appearance switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} mode.`,
      type: 'theme',
      badge: newTheme === 'dark' ? 'Dark' : 'Light',
    });
  };

  const handleSelectLocale = (newLocale: 'en' | 'ar') => {
    if (newLocale === locale) return;
    dispatch(setLocale(newLocale));
    addHistoryEntry({
      title: newLocale === 'ar' ? 'تغيير لغة العرض' : 'Language Switched',
      description:
        newLocale === 'ar'
          ? 'تم تغيير لغة لوحة التحكم إلى اللغة العربية (RTL).'
          : 'Dashboard language switched to English (LTR).',
      type: 'locale',
      badge: newLocale === 'ar' ? 'العربية' : 'English',
    });
  };

  const sessionPercent = Math.max(0, Math.min(100, Math.round((sessionRemaining / SESSION_TTL_MS) * 100)));

  return (
    <DashboardShell>
      <div className="space-y-6 sm:space-y-8 pb-10">
        {/* Header */}
      <PageHeader
        title={`${t('welcome')}, ${user?.name || 'Administrator'} 👋`}
        subtitle={
          locale === 'ar'
            ? 'مرحباً بك في لوحة تحكم USH Spa. يمكنك إدارة ملفك وتفضيلات الواجهة ومتابعة سجل الجلسة.'
            : 'Welcome to your USH Spa Dashboard overview. Manage your profile, interface preferences, and active session.'
        }
      />

      {/* Hero: Logged-in User Information Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/5 p-6 shadow-sm sm:p-8 animate-fade-in-up">
        {/* Background glow decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Avatar & Main Identity */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary via-primary/80 to-accent text-2xl font-bold text-white shadow-lg ring-4 ring-primary/20">
                {user?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <span
                className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-background"
                title="Active Now"
              >
                <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {user?.name || (locale === 'ar' ? 'المستخدم' : 'Administrator')}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {t('activeSession')}
                </span>
                {user?.user_type && (
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary uppercase tracking-wider">
                    {user.user_type}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {roleDisplay}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-muted-foreground/70" />
                  {branchDisplay}
                </span>
                {user?.id && (
                  <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground/80">
                    ID: #{user.id}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Contact & Permissions Chip Bar */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4 lg:border-t-0 lg:pt-0">
            {user?.email && (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3.5 py-2 text-xs shadow-xs">
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{user.email}</span>
              </div>
            )}
            {user?.phone_number && (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3.5 py-2 text-xs shadow-xs">
                <Phone className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground dir-ltr">{user.phone_number}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary">
              <Shield className="h-4 w-4" />
              <span>
                {permissions.length > 0
                  ? `${permissions.length} ${t('permissionsCount')}`
                  : locale === 'ar' ? 'صلاحيات كاملة' : 'Full Access Permissions'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Preferences & Session Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Theme Selection */}
        <SectionCard
          title={t('themePreference')}
          subtitle={locale === 'ar' ? 'اختر مظهر الواجهة المفضل لديك' : 'Choose your preferred dashboard interface appearance'}
          action={
            <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold capitalize text-foreground">
              {theme === 'dark' ? t('dark') : t('light')}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Light Theme Button */}
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer',
                theme === 'light'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 transition group-hover:scale-105">
                  <Sun className="h-6 w-6" />
                </div>
                {theme === 'light' && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="font-bold text-foreground text-base">{t('light')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === 'ar' ? 'مظهر نهاري مشرق وعالي الوضوح' : 'Bright, high-contrast daytime interface'}
                </p>
              </div>
              {/* Visual preview swatch */}
              <div className="mt-4 h-10 w-full rounded-xl border border-border/80 bg-slate-50 p-1.5 flex items-center gap-1.5 overflow-hidden">
                <div className="h-full w-6 rounded-md bg-slate-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-12 rounded bg-slate-300" />
                  <div className="h-1.5 w-20 rounded bg-slate-200" />
                </div>
              </div>
            </button>

            {/* Dark Theme Button */}
            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer',
                theme === 'dark'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 transition group-hover:scale-105">
                  <Moon className="h-6 w-6" />
                </div>
                {theme === 'dark' && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="font-bold text-foreground text-base">{t('dark')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {locale === 'ar' ? 'مظهر داكن مريح للعين في الإضاءة الخافتة' : 'Sleek dark interface with deep contrast'}
                </p>
              </div>
              {/* Visual preview swatch */}
              <div className="mt-4 h-10 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-1.5 flex items-center gap-1.5 overflow-hidden">
                <div className="h-full w-6 rounded-md bg-zinc-800" />
                <div className="flex-1 space-y-1">
                  <div className="h-2 w-12 rounded bg-zinc-700" />
                  <div className="h-1.5 w-20 rounded bg-zinc-800" />
                </div>
              </div>
            </button>
          </div>
        </SectionCard>

        {/* 2. Language Selection */}
        <SectionCard
          title={t('languagePreference')}
          subtitle={locale === 'ar' ? 'اختر لغة النظام واتجاه العرض' : 'Choose your dashboard display language and text direction'}
          action={
            <span className="rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-semibold uppercase text-foreground">
              {locale}
            </span>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* English Button */}
            <button
              type="button"
              onClick={() => handleSelectLocale('en')}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer',
                locale === 'en'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-105 font-bold text-lg">
                  EN
                </div>
                {locale === 'en' && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-base">English</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                    LTR
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Left-to-right standard English interface
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-primary font-medium">
                <Languages className="h-3.5 w-3.5" />
                <span>Default International</span>
              </div>
            </button>

            {/* Arabic Button */}
            <button
              type="button"
              onClick={() => handleSelectLocale('ar')}
              className={cn(
                'group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 hover:shadow-md cursor-pointer',
                locale === 'ar'
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                  : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent transition group-hover:scale-105 font-bold text-lg">
                  ع
                </div>
                {locale === 'ar' && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-foreground text-base">العربية</p>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                    RTL
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  الواجهة العربية المعتمدة من اليمين إلى اليسار
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-accent font-medium">
                <Languages className="h-3.5 w-3.5" />
                <span>الواجهة العربية الكاملة</span>
              </div>
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Grid: Session & Security Details + History Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Session & Security Info */}
        <SectionCard
          title={t('sessionInfo')}
          subtitle={locale === 'ar' ? 'معلومات جلسة العمل الحالية والأمان' : 'Current active session and platform security details'}
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            {/* Session Expiry Progress */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">{t('sessionExpiresIn')}</span>
                <span className="font-mono font-bold text-primary">{formatRemainingTime(sessionRemaining)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                  style={{ width: `${sessionPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
                <span>12h Max Session</span>
                <span>{sessionPercent}% Valid</span>
              </div>
            </div>

            {/* Session Details List */}
            <div className="divide-y divide-border/50 text-xs">
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {t('loginTime')}
                </span>
                <span className="font-medium text-foreground text-right">{loginTimeStr}</span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Laptop className="h-3.5 w-3.5 text-primary" />
                  {t('deviceInfo')}
                </span>
                <span className="font-medium text-foreground text-right">
                  {clientInfo.os} · {clientInfo.browser}
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Timezone
                </span>
                <span className="font-medium text-foreground font-mono">Asia/Kuwait (GMT+3)</span>
              </div>

              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Token Type
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Bearer Verified
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* History / Activity Log */}
        <SectionCard
          title={t('activityHistory')}
          subtitle={
            locale === 'ar'
              ? 'سجل العمليات وتسجيل الدخول الأخير لحسابك'
              : 'Recent authentication checkpoints and preference updates'
          }
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadHistory}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition"
                title="Refresh"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              {historyList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{t('clearHistory')}</span>
                </button>
              )}
            </div>
          }
        >
          {historyList.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              <p>{t('noHistory')}</p>
            </div>
          ) : (
            <div className="relative space-y-4">
              {/* Timeline Connector Line */}
              <div className="absolute top-2 bottom-2 ltr:left-4 rtl:right-4 w-px bg-border/70" />

              <div className="space-y-3">
                {historyList.map((item) => {
                  const getIcon = () => {
                    switch (item.type) {
                      case 'auth':
                        return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
                      case 'theme':
                        return <Sun className="h-4 w-4 text-amber-500" />;
                      case 'locale':
                        return <Languages className="h-4 w-4 text-primary" />;
                      default:
                        return <Sparkles className="h-4 w-4 text-accent" />;
                    }
                  };

                  return (
                    <div
                      key={item.id}
                      className="relative flex items-start gap-3.5 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition hover:bg-muted/40"
                    >
                      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card shadow-xs border border-border/80">
                        {getIcon()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {item.badge && (
                        <span className="shrink-0 rounded-full border border-border/60 bg-card px-2.5 py-0.5 text-[10px] font-medium text-foreground">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>
      </div>
      </div>
    </DashboardShell>
  );
}
