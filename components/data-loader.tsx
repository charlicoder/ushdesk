'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchDashboardData } from '@/store/slices/dataSlice';

export function DataLoader({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.data.status);

  useEffect(() => {
    if (status === 'idle') dispatch(fetchDashboardData());
  }, [dispatch, status]);

  return <>{children}</>;
}
