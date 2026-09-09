'use client';

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

// ─── Earnings Area Chart ───────────────────────────────────────────────────────
interface EarningsAreaChartProps {
  data: { date: string; earnings: number; bookings: number }[];
  formatValue: (v: number) => string;
}

export function EarningsAreaChart({ data, formatValue }: EarningsAreaChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[300px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="w-full" style={{ height: 300, minHeight: 300, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(v: number) => [formatValue(v), 'Earnings']}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="#0d9488"
            strokeWidth={2.5}
            fill="url(#earningsGrad)"
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Service Category Pie Chart ────────────────────────────────────────────────
interface ServiceMixChartProps {
  data: { name: string; value: number; color?: string }[];
}

const DEFAULT_PALETTE = ['#0d9488', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#10b981'];

export function ServiceMixChart({ data }: ServiceMixChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[300px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="w-full" style={{ height: 300, minHeight: 300, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="46%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={3}
            isAnimationActive={true}
            animationDuration={800}
          >
            {data.map((entry, i) => (
              <Cell
                key={`cell-${entry.name || i}`}
                fill={entry.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(val: number, name: string) => [`${val}%`, name]}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Weekly Overview Bar Chart ─────────────────────────────────────────────────
interface WeeklyBarChartProps {
  data: { day: string; bookings: number; earnings?: number }[];
}

export function WeeklyBarChart({ data }: WeeklyBarChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[260px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="w-full" style={{ height: 260, minHeight: 260, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="bookings"
            radius={[6, 6, 0, 0]}
            fill="#0d9488"
            isAnimationActive={true}
            animationDuration={800}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
