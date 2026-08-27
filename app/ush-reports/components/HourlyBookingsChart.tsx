import React from 'react';
import { Language, t } from '@/lib/translations';
import { HOURLY_BOOKINGS } from '@/data/mockData';
import HourlyChartInner from './HourlyBookingsChartInner';

interface Props { language: Language; }

export default function HourlyBookingsChart({ language }: Props) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4">
        <h3 className="text-base font-bold text-foreground">{t(language, 'chart_hourly_bookings')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {language === 'ar' ? 'توزيع الحجوزات حسب الساعة — متوسط شهري' : 'Booking distribution by hour — monthly average'}
        </p>
      </div>
      <HourlyChartInner data={HOURLY_BOOKINGS} />
    </div>
  );
}