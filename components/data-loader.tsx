'use client';

/**
 * DataLoader — previously dispatched fetchDashboardData to seed mock data into Redux.
 * Now that mock data is removed, this component is a transparent pass-through.
 * Each page fetches its own data directly from the real API via authedFetch.
 */
export function DataLoader({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
