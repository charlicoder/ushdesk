'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TOP_SERVICES } from '@/data/mockData';
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
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t(language, 'col_service_name')}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t(language, 'col_category')}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t(language, 'col_bookings')}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t(language, 'col_revenue')}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t(language, 'col_growth')}</th>
            </tr>
          </thead>
          <tbody>
            {TOP_SERVICES.map((svc, idx) => (
              <tr
                key={`top-svc-${svc.id}`}
                className="border-b border-border/50 hover:bg-muted/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground text-sm">{svc.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {svc.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-end font-tabular text-sm text-foreground font-semibold">
                  {svc.bookings}
                </td>
                <td className="px-4 py-3 text-end font-tabular text-sm font-bold text-foreground">
                  {svc.revenue.toLocaleString()} {t(language, 'sar')}
                </td>
                <td className="px-4 py-3 text-end">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold font-tabular ${svc.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {svc.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(svc.growth)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
