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
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

// ─── Revenue Area Chart ────────────────────────────────────────────────────────
interface RevenueAreaChartProps {
  data: { date: string; revenue: number; bookings: number }[];
}

export function RevenueAreaChartDynamic({ data }: RevenueAreaChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[240px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="w-full" style={{ height: 240, minHeight: 240, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#be123c" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#be123c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(v: number) => [`${Number(v).toLocaleString()} SAR`, 'Revenue']}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#be123c"
            strokeWidth={2.5}
            fill="url(#revenueGrad)"
            isAnimationActive={true}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Hourly Bookings Bar Chart ─────────────────────────────────────────────────
interface HourlyBarChartProps {
  data: { hour: string; bookings: number }[];
}

export function HourlyBarChartDynamic({ data }: HourlyBarChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[208px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  const maxVal = data.length > 0 ? Math.max(...data.map((d) => d.bookings)) : 0;

  return (
    <div className="w-full" style={{ height: 208, minHeight: 208, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(v: number) => [`${v} bookings`, 'Bookings']}
          />
          <Bar
            dataKey="bookings"
            radius={[6, 6, 0, 0]}
            isAnimationActive={true}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell
                key={`bar-cell-${index}`}
                fill={entry.bookings === maxVal ? '#be123c' : '#fb7185'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Service Category Pie Chart ────────────────────────────────────────────────
interface ServicePieChartProps {
  data: { name: string; value: number; revenue?: number; color: string }[];
}

export function ServicePieChartDynamic({ data }: ServicePieChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-[176px] w-full rounded-xl bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="w-full" style={{ height: 176, minHeight: 176, minWidth: 0 }}>
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
            nameKey="name"
            isAnimationActive={true}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell key={`pie-cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12,
            }}
            formatter={(v: number, _: string, p: any) => [
              `${v}% · ${(p?.payload?.revenue ?? 0).toLocaleString()} SAR`,
              p?.payload?.name ?? '',
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
