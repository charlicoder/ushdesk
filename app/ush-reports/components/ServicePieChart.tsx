import React from 'react';
import { Language, t } from '@/lib/translations';
import PieChartInner from './ServicePieChartInner';

interface Props { language: Language; }

export default function ServicePieChart({ language }: Props) {
  return (
    <div className="card-surface p-5 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">{t(language, 'chart_service_split')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {language === 'ar' ? 'توزيع الإيرادات حسب الفئة' : 'Revenue by service category'}
        </p>
      </div>
      <PieChartInner data={[]} />
      <div className="mt-4 flex items-center justify-center py-4 text-muted-foreground text-sm">
        {language === 'ar' ? 'لا توجد بيانات متاحة' : 'No data available'}
      </div>
    </div>
  );
}
