export type Language = 'en' | 'ar';

const en = {
  page_reports_title: 'Performance Reports',
  page_reports_subtitle: 'Analytics and insights across all branches',
  tab_daily: 'Daily',
  tab_weekly: 'Weekly',
  tab_monthly: 'Monthly',
  kpi_total_revenue: 'TOTAL REVENUE',
  kpi_total_bookings: 'TOTAL BOOKINGS',
  kpi_avg_value: 'AVG. SERVICE VALUE',
  kpi_new_customers: 'NEW CUSTOMERS',
  kpi_cancellation_rate: 'CANCELLATION RATE',
  sar: 'SAR',
  vs_last_period: 'vs last period',
  chart_revenue_trend: 'Revenue Trend',
  chart_service_split: 'Service Category Split',
  chart_hourly_bookings: 'Bookings by Hour',
  table_top_services: 'Top Services',
  table_top_customers: 'Top Customers',
  col_service_name: 'Service',
  col_category: 'Category',
  col_bookings: 'Bookings',
  col_revenue: 'Revenue',
  col_growth: 'Growth',
  col_customer_name: 'Customer',
  col_visits: 'Visits',
  col_total_spend: 'Total Spend',
  col_last_visit: 'Last Visit',
};

const ar: Record<keyof typeof en, string> = {
  page_reports_title: 'تقارير الأداء',
  page_reports_subtitle: 'التحليلات والرؤى عبر جميع الفروع',
  tab_daily: 'يومي',
  tab_weekly: 'أسبوعي',
  tab_monthly: 'شهري',
  kpi_total_revenue: 'إجمالي الإيرادات',
  kpi_total_bookings: 'إجمالي الحجوزات',
  kpi_avg_value: 'متوسط قيمة الخدمة',
  kpi_new_customers: 'العملاء الجدد',
  kpi_cancellation_rate: 'معدل الإلغاء',
  sar: 'ر.س',
  vs_last_period: 'مقارنة بالفترة السابقة',
  chart_revenue_trend: 'اتجاه الإيرادات',
  chart_service_split: 'توزيع الخدمات',
  chart_hourly_bookings: 'المواعيد حسب الساعة',
  table_top_services: 'أفضل الخدمات',
  table_top_customers: 'أفضل العملاء',
  col_service_name: 'الخدمة',
  col_category: 'الفئة',
  col_bookings: 'الحجوزات',
  col_revenue: 'الإيرادات',
  col_growth: 'النمو',
  col_customer_name: 'العميل',
  col_visits: 'الزيارات',
  col_total_spend: 'إجمالي الإنفاق',
  col_last_visit: 'آخر زيارة',
};

const translations = { en, ar };

export function t(lang: Language, key: keyof typeof en): string {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
