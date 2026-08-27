'use client';
import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';

interface DataItem { name: string; value: number; revenue: number; color: string; }
interface Props { data: DataItem[]; }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: DataItem }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-xl shadow-card-elevated px-3 py-2.5 text-sm">
      <p className="font-semibold text-foreground">{d.name}</p>
      <p className="font-tabular font-bold" style={{ color: d.color }}>{d.value}%</p>
      <p className="text-muted-foreground text-xs">{d.revenue.toLocaleString()} SAR</p>
    </div>
  );
}

export default function ServicePieChartInner({ data }: Props) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[180px] w-full min-w-0 bg-muted/20 animate-pulse rounded-xl" />;

  return (
    <div className="h-[180px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`pie-cell-${index + 1}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
