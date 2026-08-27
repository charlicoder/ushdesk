'use client';

import { useAppSelector } from '@/store/hooks';
import { translations, type TranslationKey, type Locale, isRTL } from '@/lib/i18n';

export function useI18n() {
  const locale = useAppSelector((s) => s.ui.locale);
  const t = (key: TranslationKey): string => translations[locale][key] ?? key;
  const dir = isRTL(locale) ? 'rtl' : 'ltr';
  return { t, locale, dir, isRTL: isRTL(locale) };
}

export type { Locale };
