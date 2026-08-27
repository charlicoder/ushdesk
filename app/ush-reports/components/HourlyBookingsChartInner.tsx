'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface DataPoint { hour: string; bookings: number; }
interface Props { data: DataPoint[]; }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-card-elevated px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="text-primary font-tabular font-bold">{payload[0]?.value} bookings</p>
    </div>
  );
}

export default function HourlyBookingsChartInner({ data }: Props) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[200px] w-full min-w-0 bg-muted/20 animate-pulse rounded-xl" />;

  const maxVal = Math.max(...data.map((d) => d.bookings));
  return (
    <div className="h-[200px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="bookings" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`bar-cell-${index + 1}`}
                fill={entry.bookings === maxVal ? '#be123c' : '#fb7185'}
                opacity={entry.bookings === maxVal ? 1 : 0.65}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
