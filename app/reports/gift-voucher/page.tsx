'use client';

import React, { useState } from 'react';
import { Gift, UserCheck } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { cn } from '@/lib/utils';
import { VoucherSalesReportTab } from '@/components/reports/VoucherSalesReportTab';
import { EmployeesReportTab } from '@/components/reports/EmployeesReportTab';

// ── Extensible Tab Registry (add future report tabs here) ─────────────────────

type ReportTabId = 'voucher-sales' | 'employees';

interface ReportTabConfig {
  id: ReportTabId;
  label: string;
  Icon: React.ElementType;
}

const REPORT_TABS: ReportTabConfig[] = [
  { id: 'voucher-sales', label: 'Voucher Sales Report', Icon: Gift },
  { id: 'employees',     label: 'Employees Report',     Icon: UserCheck },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GiftVoucherReportPage() {
  const [activeTab, setActiveTab] = useState<ReportTabId>('voucher-sales');

  return (
    <DashboardShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Gift Voucher & Operational Reports"
          subtitle="Comprehensive reporting for gift voucher sales, redemptions, and therapist completed services"
        />
      </div>

      {/* Tabs — matches Financial Reports pill-bar style */}
      <div className="mt-5 flex flex-wrap items-center rounded-2xl border border-border/60 bg-card p-1.5 gap-1 shadow-xs">
        {REPORT_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer',
              activeTab === id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      <div className="mt-5">
        {activeTab === 'voucher-sales' && <VoucherSalesReportTab />}
        {activeTab === 'employees' && <EmployeesReportTab />}
      </div>
    </DashboardShell>
  );
}
