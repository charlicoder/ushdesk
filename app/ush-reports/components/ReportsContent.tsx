'use client';
import React, { useState } from 'react';
import { useAppSelector } from '@/store/hooks';
import { t } from '@/lib/translations';
import ReportsKpiGrid from './ReportsKpiGrid';
import RevenueAreaChart from './RevenueAreaChart';
import HourlyBookingsChart from './HourlyBookingsChart';
import ServicePieChart from './ServicePieChart';
import TopServicesTable from './TopServicesTable';
import TopCustomersTable from './TopCustomersTable';

type Period = 'daily' | 'weekly' | 'monthly';

const PERIOD_CONFIGS: Record<Period, {
  revenueMultiplier: number;
  bookingsMultiplier: number;
  avgValue: number;
  newCustomers: number;
  cancellationRate: number;
  revenueTrend: number;
  bookingsTrend: number;
}> = {
  daily: { revenueMultiplier: 1, bookingsMultiplier: 1, avgValue: 287, newCustomers: 4, cancellationRate: 8.3, revenueTrend: 12.4, bookingsTrend: 6.7 },
  weekly: { revenueMultiplier: 7, bookingsMultiplier: 7, avgValue: 294, newCustomers: 28, cancellationRate: 7.1, revenueTrend: -3.2, bookingsTrend: 4.1 },
  monthly: { revenueMultiplier: 30, bookingsMultiplier: 30, avgValue: 301, newCustomers: 112, cancellationRate: 6.8, revenueTrend: 18.9, bookingsTrend: 14.3 },
};

export default function ReportsContent() {
  const language = useAppSelector((s) => s.ui.language);
  const direction = useAppSelector((s) => s.ui.direction);
  const [period, setPeriod] = useState<Period>('monthly');

  const cfg = PERIOD_CONFIGS[period];
  const baseRevenue = 3800;
  const baseBookings = 12;

  const tabs: { key: Period; label: string }[] = [
    { key: 'daily', label: t(language, 'tab_daily') },
    { key: 'weekly', label: t(language, 'tab_weekly') },
    { key: 'monthly', label: t(language, 'tab_monthly') },
  ];

  return (
    <div className="space-y-6 fade-in" dir={direction}>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t(language, 'page_reports_title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t(language, 'page_reports_subtitle')}</p>
        </div>
        {/* Period Tabs */}
        <div className="flex items-center bg-secondary rounded-xl p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={`period-tab-${tab.key}`}
              onClick={() => setPeriod(tab.key)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 active:scale-95 ${
                period === tab.key
                  ? 'gradient-primary text-white shadow-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <ReportsKpiGrid
        period={period}
        totalRevenue={baseRevenue * cfg.revenueMultiplier}
        totalBookings={baseBookings * cfg.bookingsMultiplier}
        avgValue={cfg.avgValue}
        newCustomers={cfg.newCustomers}
        cancellationRate={cfg.cancellationRate}
        revenueTrend={cfg.revenueTrend}
        bookingsTrend={cfg.bookingsTrend}
        language={language}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <RevenueAreaChart language={language} period={period} />
        </div>
        <div>
          <ServicePieChart language={language} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">
        <HourlyBookingsChart language={language} />
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TopServicesTable language={language} />
        <TopCustomersTable language={language} />
      </div>
    </div>
  );
}
