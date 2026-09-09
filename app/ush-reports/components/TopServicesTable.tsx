'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { t, Language } from '@/lib/translations';

interface Props { language: Language; }

export default function TopServicesTable({ language }: Props) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">{t(language, 'table_top_services')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {language === 'ar' ? 'مرتبة حسب الإيرادات' : 'Ranked by revenue'}
        </p>
      </div>
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
      </div>
    </div>
  );
}
