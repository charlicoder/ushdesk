'use client';

import { DashboardShell } from '@/components/dashboard/shell';
import { PageHeader } from '@/components/dashboard/page-header';
import { BarChart3, Clock, TrendingUp, PieChart, FileText } from 'lucide-react';

export default function FinanceReportsPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Finance Reports"
        subtitle="Advanced financial analytics and reporting tools"
      />

      {/* Coming Soon Section */}
      <div className="flex flex-col items-center justify-center min-h-[480px] rounded-3xl border border-dashed border-border/60 bg-card/40 backdrop-blur-sm mt-4">
        <div className="relative mb-6">
          {/* Glow ring */}
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
          <div className="relative grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 shadow-xl shadow-primary/10">
            <BarChart3 className="h-12 w-12 text-primary" />
          </div>
        </div>

        <h2 className="text-3xl font-extrabold tracking-tight mb-2">
          Coming Soon
        </h2>
        <p className="text-muted-foreground text-sm max-w-md text-center mb-10">
          Advanced finance reporting tools are under construction. You&apos;ll soon have full visibility into revenue trends, payment analytics, and financial summaries.
        </p>

        {/* Feature preview cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl w-full px-6">
          {[
            { icon: TrendingUp, label: 'Revenue Trends',       desc: 'Daily, weekly, monthly revenue analysis' },
            { icon: PieChart,   label: 'Payment Mix',           desc: 'Breakdown by gateway & method' },
            { icon: FileText,   label: 'Financial Statements',  desc: 'Exportable P&L summaries' },
            { icon: Clock,      label: 'Settlement Reports',    desc: 'Deposit & settlement tracking' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-muted/30 p-5 text-center"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
