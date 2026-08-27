import React from 'react';
import { Language, t } from '@/lib/translations';
import { SERVICE_CATEGORY_DATA } from '@/data/mockData';
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
      <PieChartInner data={SERVICE_CATEGORY_DATA} />
      {/* Legend */}
      <div className="mt-4 space-y-2">
        {SERVICE_CATEGORY_DATA.map((item) => (
          <div key={`legend-svc-${item.name}`} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-foreground font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-tabular">{item.value}%</span>
              <span className="text-xs font-semibold text-foreground font-tabular">{item.revenue.toLocaleString()} SAR</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
