import React from 'react';
import { DashboardShell } from '@/components/dashboard/shell';
import ReportsContent from './components/ReportsContent';

export default function ReportsPage() {
  return (
    <DashboardShell>
      <ReportsContent />
    </DashboardShell>
  );
}