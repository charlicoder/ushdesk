'use client';
import React from 'react';
import { TOP_CUSTOMERS } from '@/data/mockData';
import { t, Language } from '@/lib/translations';

interface Props { language: Language; }

export default function TopCustomersTable({ language }: Props) {
  return (
    <div className="card-surface overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-bold text-foreground">{t(language, 'table_top_customers')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {language === 'ar' ? 'مرتبة حسب إجمالي الإنفاق' : 'Ranked by total spend'}
        </p>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40">
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t(language, 'col_customer_name')}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t(language, 'col_visits')}</th>
              <th className="px-4 py-2.5 text-end text-xs font-semibold text-muted-foreground">{t(language, 'col_total_spend')}</th>
              <th className="px-4 py-2.5 text-start text-xs font-semibold text-muted-foreground">{t(language, 'col_last_visit')}</th>
            </tr>
          </thead>
          <tbody>
            {TOP_CUSTOMERS.map((cust, idx) => (
              <tr
                key={`top-cust-${cust.id}`}
                className="border-b border-border/50 hover:bg-muted/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {cust.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{cust.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-32">{cust.branch}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-end font-tabular font-semibold text-foreground">
                  {cust.visits}
                </td>
                <td className="px-4 py-3 text-end font-tabular font-bold text-foreground">
                  {cust.totalSpend.toLocaleString()} {t(language, 'sar')}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground font-tabular">
                    {cust.lastVisit.split('-').reverse().join('/')}
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
