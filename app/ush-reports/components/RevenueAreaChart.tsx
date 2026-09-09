import React from 'react';
import { Language, t } from '@/lib/translations';
import AreaChartInner from './RevenueAreaChartInner';

interface Props {
  language: Language;
  period: string;
}

export default function RevenueAreaChart({ language, period }: Props) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">{t(language, 'chart_revenue_trend')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {language === 'ar' ? 'آخر 30 يوم — بالريال السعودي' : 'Last 30 days — SAR'}
          </p>
        </div>
      </div>
      <AreaChartInner data={[]} />
    </div>
  );
}
