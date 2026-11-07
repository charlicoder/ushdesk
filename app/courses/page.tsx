'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/shell';
import { authedFetch } from '@/lib/authedFetch';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { SellCourseModal } from '@/components/bookings/SellCourseModal';
import {
  Layers,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  BookMarked,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  Calculator,
  Eye,
  Users,
  Phone,
  User,
  ExternalLink,
} from 'lucide-react';

interface CourseItem {
  id: string;
  code: string;
  name: string;
  name_en?: string;
  name_ar?: string;
  description?: string;
  description_en?: string;
  description_ar?: string;
  service_id: string;
  service?: {
    id: string;
    name: string;
    duration_minutes: number;
    base_price: string;
    currency: string;
  };
  arrangement_type: string;
  arrangement_type_label?: string;
  unit_price?: string;
  total_sessions: number;
  validity_days: number;
  price: string;
  currency: string;
  status: 'active' | 'inactive' | 'draft';
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

const B = {
  espresso: '#543C30',
  espressoHover: '#6b4f41',
  linen: '#dbcdc2',
  blush: '#daccc1',
  lineMuted: '#e8ddd7',
  bg: '#faf7f5',
  cardBg: '#ffffff',
  textMain: '#2c1a12',
  textMuted: '#8a6f63',
  pillBg: '#f2ede9',
} as const;

const ARRANGEMENT_OPTIONS = [
  { value: 'single_room', label: 'Single Room' },
  { value: 'couple_room', label: 'Couple Room' },
  { value: 'double_room', label: 'Double Room' },
  { value: 'open_area', label: 'Open Area' },
  { value: 'vip_suite', label: 'VIP Suite' },
  { value: 'private_suite', label: 'Private Suite' },
  { value: 'thai_room', label: 'Thai Room' },
  { value: 'japanese_room', label: 'Japanese Room' },
  { value: 'other', label: 'Other' },
];

const ARRANGEMENT_LABELS: Record<string, string> = Object.fromEntries(
  ARRANGEMENT_OPTIONS.map((o) => [o.value, o.label])
);

function formatDate(d?: string | null): string {
  if (!d) return '—';
  try {
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(d).slice(0, 10);
  }
}

export default function CoursesPage() {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.USHSPA_COURSES_EDIT) || can(PERMISSIONS.USHSPA_COURSES);

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [services, setServices] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [arrangementFilter, setArrangementFilter] = useState<string>('all');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sell Course modal state
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [sellingCourse, setSellingCourse] = useState<CourseItem | null>(null);

  // Subscriptions Count & Customers modal state
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [customersModalOpen, setCustomersModalOpen] = useState(false);
  const [selectedCourseForCustomers, setSelectedCourseForCustomers] = useState<CourseItem | null>(null);
  const [courseSubscriptions, setCourseSubscriptions] = useState<Record<string, any>[]>([]);
  const [loadingCourseSubs, setLoadingCourseSubs] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  const [formData, setFormData] = useState({
    code: '',
    name_en: '',
    name_ar: '',
    description_en: '',
    description_ar: '',
    service_id: '',
    arrangement_type: 'single_room',
    total_sessions: 6,
    validity_days: 90,
    price: '',
    currency: 'KWD',
    status: 'active' as 'active' | 'inactive' | 'draft',
    display_order: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [coursesRes, servicesRes, subsRes] = await Promise.all([
        authedFetch('/api/v1/courses?all=true'),
        authedFetch('/api/v1/services'),
        authedFetch('/booknpay/api/v1/course-subscriptions/?page_size=1000').catch(() => null),
      ]);

      const coursesJson = await coursesRes.json().catch(() => ({}));
      const servicesJson = await servicesRes.json().catch(() => ({}));

      if (!coursesRes.ok) {
        throw new Error(
          coursesJson?.error?.message || coursesJson?.message || 'Failed to load courses'
        );
      }

      const courseList: CourseItem[] = Array.isArray(coursesJson?.data)
        ? coursesJson.data
        : Array.isArray(coursesJson?.results)
        ? coursesJson.results
        : Array.isArray(coursesJson)
        ? coursesJson
        : [];

      const serviceList = Array.isArray(servicesJson?.data)
        ? servicesJson.data
        : Array.isArray(servicesJson?.results)
        ? servicesJson.results
        : Array.isArray(servicesJson)
        ? servicesJson
        : [];

      if (subsRes && subsRes.ok) {
        const subsJson = await subsRes.json().catch(() => ({}));
        const rawSubs: Record<string, any>[] = Array.isArray(subsJson?.results)
          ? subsJson.results
          : Array.isArray(subsJson?.data)
          ? subsJson.data
          : Array.isArray(subsJson)
          ? subsJson
          : [];
        const counts: Record<string, number> = {};
        for (const s of rawSubs) {
          const cid = String(s.course_id || '');
          if (cid) counts[cid] = (counts[cid] || 0) + 1;
        }
        setSubCounts(counts);
      }

      setCourses(courseList);
      setServices(serviceList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to fetch courses.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleViewCustomers = async (course: CourseItem) => {
    setSelectedCourseForCustomers(course);
    setCustomersModalOpen(true);
    setCustomerSearch('');
    setLoadingCourseSubs(true);
    try {
      const res = await authedFetch(
        `/booknpay/api/v1/course-subscriptions/?course_id=${course.id}&page_size=100`
      );
      const json = await res.json().catch(() => ({}));
      const list: Record<string, any>[] = Array.isArray(json?.results)
        ? json.results
        : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      setCourseSubscriptions(list);
      setSubCounts((prev) => ({ ...prev, [course.id]: list.length }));
    } catch {
      setCourseSubscriptions([]);
    } finally {
      setLoadingCourseSubs(false);
    }
  };

  const filteredSubs = useMemo(() => {
    if (!customerSearch.trim()) return courseSubscriptions;
    const q = customerSearch.toLowerCase();
    return courseSubscriptions.filter((sub) => {
      const cust = sub.customer_data || {};
      const name = (
        cust.name ||
        cust.customer_name ||
        cust.full_name ||
        `${cust.first_name || ''} ${cust.last_name || ''}`
      ).toLowerCase();
      const phone = String(cust.phone_number || cust.phone || '').toLowerCase();
      const num = String(sub.subscription_number || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || num.includes(q);
    });
  }, [courseSubscriptions, customerSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (arrangementFilter !== 'all' && c.arrangement_type !== arrangementFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCode = (c.code || '').toLowerCase().includes(q);
        const matchName = (c.name || c.name_en || '').toLowerCase().includes(q);
        const matchAr = (c.name_ar || '').toLowerCase().includes(q);
        const matchService = (c.service?.name || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchAr && !matchService) return false;
      }
      return true;
    });
  }, [courses, statusFilter, arrangementFilter, search]);

  const stats = useMemo(() => {
    const total = courses.length;
    const active = courses.filter((c) => c.status === 'active').length;
    const inactive = courses.filter((c) => c.status !== 'active').length;
    const avgSessions =
      total > 0
        ? Math.round(courses.reduce((acc, c) => acc + (Number(c.total_sessions) || 0), 0) / total)
        : 0;
    return { total, active, inactive, avgSessions };
  }, [courses]);

  const openCreateModal = () => {
    setEditingCourse(null);
    setFormError(null);
    const defaultSvc = services[0];
    const defaultPrice = defaultSvc?.base_price
      ? (Number(defaultSvc.base_price) * 6 * 0.85).toFixed(3)
      : '90.000';
    setFormData({
      code: `CRS-${Math.floor(100 + Math.random() * 900)}`,
      name_en: '',
      name_ar: '',
      description_en: '',
      description_ar: '',
      service_id: defaultSvc?.id ? String(defaultSvc.id) : '',
      arrangement_type: 'single_room',
      total_sessions: 6,
      validity_days: 90,
      price: defaultPrice,
      currency: 'KWD',
      status: 'active',
      display_order: courses.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (course: CourseItem) => {
    setEditingCourse(course);
    setFormError(null);
    setFormData({
      code: course.code || '',
      name_en: course.name_en || course.name || '',
      name_ar: course.name_ar || '',
      description_en: course.description_en || course.description || '',
      description_ar: course.description_ar || '',
      service_id: course.service_id || course.service?.id || '',
      arrangement_type: course.arrangement_type || 'single_room',
      total_sessions: Number(course.total_sessions) || 6,
      validity_days: Number(course.validity_days) || 90,
      price: course.price || '0.000',
      currency: course.currency || 'KWD',
      status: course.status || 'active',
      display_order: Number(course.display_order) || 0,
    });
    setModalOpen(true);
  };

  const selectedServiceObj = useMemo(
    () => services.find((s) => String(s.id) === String(formData.service_id)),
    [services, formData.service_id]
  );

  const handleAutoCalculatePrice = () => {
    const unit = Number(selectedServiceObj?.base_price || 0);
    if (unit > 0 && formData.total_sessions > 0) {
      const full = unit * Number(formData.total_sessions);
      setFormData((prev) => ({ ...prev, price: full.toFixed(3) }));
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.code.trim() || !formData.name_en.trim() || !formData.service_id) {
      setFormError('Code, English Name, and Service are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name_en.trim(),
        name_en: formData.name_en.trim(),
        name_ar: formData.name_ar.trim(),
        description: formData.description_en.trim(),
        description_en: formData.description_en.trim(),
        description_ar: formData.description_ar.trim(),
        service_id: formData.service_id,
        arrangement_type: formData.arrangement_type,
        total_sessions: Number(formData.total_sessions),
        validity_days: Number(formData.validity_days),
        price: Number(formData.price || 0).toFixed(3),
        currency: formData.currency || 'KWD',
        status: formData.status,
        display_order: Number(formData.display_order) || 0,
      };

      const url = editingCourse ? `/api/v1/courses/${editingCourse.id}` : '/api/v1/courses';
      const method = editingCourse ? 'PATCH' : 'POST';

      const res = await authedFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          data?.error?.message ||
          data?.detail ||
          data?.message ||
          (typeof data?.error?.details === 'object'
            ? JSON.stringify(data.error.details)
            : 'Failed to save course.');
        setFormError(msg);
        return;
      }

      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Network error saving course.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (course: CourseItem) => {
    const nextStatus = course.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await authedFetch(`/api/v1/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteCourse = async (course: CourseItem) => {
    if (!window.confirm(`Delete course "${course.name}" (${course.code})?`)) return;
    try {
      const res = await authedFetch(`/api/v1/courses/${course.id}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        await loadData();
      }
    } catch {
      // ignore
    }
  };

  const handleOpenSell = (course: CourseItem) => {
    setSellingCourse(course);
    setSellModalOpen(true);
  };

  return (
    <DashboardShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-sm"
                style={{ background: B.espresso }}
              >
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2C241D]">Courses & Packages</h1>
                <p className="text-sm text-[#6E6259]">
                  Manage multi-session treatment courses with locked service, room type, and validity
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm font-medium text-[#2C241D] hover:bg-[#FAF8F5] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/bookings/course-subscriptions"
              className="px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors"
              style={{ borderColor: B.linen, background: B.pillBg, color: B.espresso }}
            >
              <BookMarked className="w-4 h-4" style={{ color: B.espresso }} />
              Subscriptions
            </Link>
            {canEdit && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                style={{ background: B.espresso }}
              >
                <Plus className="w-4 h-4 text-white" />
                New Course
              </button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                Total Courses
              </span>
              <Layers className="w-4 h-4" style={{ color: B.espresso }} />
            </div>
            <p className="text-2xl font-bold text-[#2C241D] mt-2">{stats.total}</p>
            <p className="text-xs text-[#6E6259] mt-1">Configured catalog packages</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                Active Courses
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.active}</p>
            <p className="text-xs text-[#6E6259] mt-1">Available for purchase at desk</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                Inactive / Draft
              </span>
              <XCircle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-[#2C241D] mt-2">{stats.inactive}</p>
            <p className="text-xs text-[#6E6259] mt-1">Hidden from new sales</p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#E5E0D8] shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C7D70]">
                Avg Sessions / Course
              </span>
              <Sparkles className="w-4 h-4" style={{ color: B.espresso }} />
            </div>
            <p className="text-2xl font-bold text-[#2C241D] mt-2">{stats.avgSessions}</p>
            <p className="text-xs text-[#6E6259] mt-1">Sessions per package</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 border border-[#E5E0D8] shadow-sm flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C7D70] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, course name, Arabic name, or service..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </select>

          <select
            value={arrangementFilter}
            onChange={(e) => setArrangementFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
          >
            <option value="all">All Room Types</option>
            {ARRANGEMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Courses Table */}
        <div className="bg-white rounded-2xl border border-[#E5E0D8] shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[#6E6259] flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: B.espresso }} />
              <span className="text-sm">Loading courses catalog...</span>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center mx-auto text-[#8C7D70]">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[#2C241D]">No courses found</h3>
              <p className="text-xs text-[#6E6259] max-w-md mx-auto">
                Create a multi-session course package to allow receptionists to sell prepaid session
                bundles and redeem them on bookings.
              </p>
              {canEdit && (
                <button
                  onClick={openCreateModal}
                  className="mt-2 px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                  style={{ background: B.espresso }}
                >
                  <Plus className="w-4 h-4 text-white" />
                  Create First Course
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E5E0D8] text-[11px] font-semibold uppercase tracking-wider text-[#8C7D70]">
                    <th className="py-3.5 px-4">Code & Name</th>
                    <th className="py-3.5 px-4">Locked Service</th>
                    <th className="py-3.5 px-4">Room Type</th>
                    <th className="py-3.5 px-4">Sessions & Validity</th>
                    <th className="py-3.5 px-4 text-center">Subscriptions</th>
                    <th className="py-3.5 px-4">Course Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E0D8] text-sm">
                  {filteredCourses.map((course) => {
                    const unitPrice = Number(
                      course.unit_price || course.service?.base_price || 0
                    );
                    const standardTotal = unitPrice * Number(course.total_sessions || 0);
                    const coursePrice = Number(course.price || 0);
                    const savings =
                      standardTotal > coursePrice ? standardTotal - coursePrice : 0;

                    return (
                      <tr
                        key={course.id}
                        className="hover:bg-[#FAF8F5]/60 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {/* Code Badge matching the arrow mark in the image */}
                            <span
                              className="px-2 py-0.5 rounded-md text-white font-mono text-xs font-semibold shadow-xs"
                              style={{ background: B.espresso }}
                            >
                              {course.code}
                            </span>
                            <span className="font-semibold text-[#2C241D]">
                              {course.name_en || course.name}
                            </span>
                          </div>
                          {course.name_ar && (
                            <p className="text-xs text-[#6E6259] mt-0.5" dir="rtl">
                              {course.name_ar}
                            </p>
                          )}
                          {(course.description_en || course.description) && (
                            <p className="text-xs text-[#8C7D70] mt-1 line-clamp-1">
                              {course.description_en || course.description}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-medium text-[#2C241D]">
                            {course.service?.name || 'Service'}
                          </div>
                          <div className="text-xs text-[#6E6259]">
                            {course.service?.duration_minutes
                              ? `${course.service.duration_minutes} mins`
                              : ''}{' '}
                            {unitPrice > 0 ? `· ${unitPrice.toFixed(3)} KWD/session` : ''}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className="px-2.5 py-1 rounded-full text-xs font-medium border"
                            style={{
                              background: B.pillBg,
                              color: B.espresso,
                              borderColor: B.linen,
                            }}
                          >
                            {course.arrangement_type_label ||
                              ARRANGEMENT_LABELS[course.arrangement_type] ||
                              course.arrangement_type}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-[#2C241D]">
                            {course.total_sessions} <span className="text-xs font-normal text-[#6E6259]">sessions</span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-[#8C7D70] mt-0.5">
                            <Clock className="w-3.5 h-3.5 text-[#8C7D70]" />
                            <span>{course.validity_days} days validity</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewCustomers(course)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer hover:shadow-xs border"
                            style={{
                              background: (subCounts[course.id] || 0) > 0 ? 'rgba(84,60,48,0.08)' : '#F5F2EF',
                              color: (subCounts[course.id] || 0) > 0 ? B.espresso : '#8C7D70',
                              borderColor: (subCounts[course.id] || 0) > 0 ? B.linen : '#E5E0D8',
                            }}
                            title={`View ${subCounts[course.id] || 0} subscribed customers`}
                          >
                            <Eye className="w-3.5 h-3.5" style={{ color: (subCounts[course.id] || 0) > 0 ? B.espresso : '#8C7D70' }} />
                            <span>{subCounts[course.id] || 0}</span>
                          </button>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-[#2C241D]">
                            {coursePrice.toFixed(3)} {course.currency || 'KWD'}
                          </div>
                          {savings > 0 && (
                            <div className="text-[11px] text-emerald-700 font-medium">
                              Saves {savings.toFixed(3)} KWD
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              course.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : course.status === 'draft'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                course.status === 'active'
                                  ? 'bg-emerald-600'
                                  : course.status === 'draft'
                                  ? 'bg-amber-600'
                                  : 'bg-gray-500'
                              }`}
                            />
                            {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {course.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleOpenSell(course)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border hover:opacity-90"
                                style={{
                                  background: B.pillBg,
                                  color: B.espresso,
                                  borderColor: B.linen,
                                }}
                              >
                                Sell
                              </button>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => openEditModal(course)}
                                  title="Edit Course"
                                  className="p-1.5 rounded-lg text-[#6E6259] hover:text-[#543C30] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(course)}
                                  title={
                                    course.status === 'active' ? 'Deactivate' : 'Activate'
                                  }
                                  className="p-1.5 rounded-lg text-[#6E6259] hover:text-[#543C30] hover:bg-[#FAF8F5] transition-colors cursor-pointer"
                                >
                                  {course.status === 'active' ? (
                                    <XCircle className="w-4 h-4 text-amber-600" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(course)}
                                  title="Delete Course"
                                  className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sell Course Subscription Modal */}
      {sellModalOpen && (
        <SellCourseModal
          courseId={sellingCourse?.id}
          courses={courses}
          isOpen={sellModalOpen}
          onClose={() => {
            setSellModalOpen(false);
            setSellingCourse(null);
          }}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Subscribed Customers List Popup Modal */}
      {customersModalOpen && selectedCourseForCustomers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ borderColor: B.linen, maxHeight: 'min(90vh, 760px)' }}
          >
            {/* Header with #543C30 */}
            <div
              className="flex items-center justify-between px-6 py-4 text-white shrink-0"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-mono font-bold"
                      style={{ background: 'rgba(255,255,255,0.2)' }}
                    >
                      {selectedCourseForCustomers.code}
                    </span>
                    <h3 className="text-base font-extrabold text-white">
                      {selectedCourseForCustomers.name_en || selectedCourseForCustomers.name}
                    </h3>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: B.linen }}>
                    Subscribed Customers ({courseSubscriptions.length})
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCustomersModalOpen(false);
                  setSelectedCourseForCustomers(null);
                }}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Course Summary Banner */}
            <div
              className="px-6 py-3 border-b flex items-center justify-between text-xs shrink-0"
              style={{ background: B.bg, borderColor: B.lineMuted }}
            >
              <div className="flex items-center gap-3 text-[#6E6259]">
                <span>
                  <strong>{selectedCourseForCustomers.total_sessions}</strong> sessions
                </span>
                <span>•</span>
                <span>
                  <strong>{selectedCourseForCustomers.validity_days}</strong> days validity
                </span>
                <span>•</span>
                <span>
                  <strong>{Number(selectedCourseForCustomers.price || 0).toFixed(3)}</strong>{' '}
                  {selectedCourseForCustomers.currency || 'KWD'}
                </span>
              </div>
              <div className="font-semibold" style={{ color: B.espresso }}>
                {courseSubscriptions.length}{' '}
                {courseSubscriptions.length === 1 ? 'Subscription' : 'Subscriptions'}
              </div>
            </div>

            {/* Search filter if there are subscriptions */}
            {courseSubscriptions.length > 0 && (
              <div className="px-6 pt-4 pb-2 shrink-0">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white"
                  style={{ borderColor: B.linen }}
                >
                  <Search className="w-4 h-4 text-[#8C7D70] shrink-0" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by customer name, phone, or subscription number..."
                    className="w-full text-xs bg-transparent outline-none text-[#2C241D] placeholder:text-[#8C7D70]"
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearch('')}
                      className="text-[#8C7D70] hover:text-[#2C241D]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {loadingCourseSubs ? (
                <div className="p-12 text-center text-[#8C7D70] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: B.espresso }} />
                  <span className="text-xs">Loading customers...</span>
                </div>
              ) : courseSubscriptions.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5E0D8] flex items-center justify-center mx-auto text-[#8C7D70]">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-[#2C241D]">No Subscriptions Yet</h4>
                  <p className="text-xs text-[#6E6259] max-w-sm mx-auto">
                    No customers have subscribed to this course package yet. You can sell this course from the Courses page table.
                  </p>
                  {selectedCourseForCustomers.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedCourseForCustomers;
                        setCustomersModalOpen(false);
                        setSelectedCourseForCustomers(null);
                        handleOpenSell(target);
                      }}
                      className="px-4 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-95 cursor-pointer shadow-sm"
                      style={{ background: B.espresso }}
                    >
                      Sell This Course Now
                    </button>
                  )}
                </div>
              ) : filteredSubs.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8C7D70]">
                  No customers match &quot;{customerSearch}&quot;
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSubs.map((sub) => {
                    const cust = sub.customer_data || {};
                    const custName =
                      cust.name ||
                      cust.customer_name ||
                      cust.full_name ||
                      [cust.first_name, cust.last_name].filter(Boolean).join(' ') ||
                      'Customer';
                    const custPhone = cust.phone_number || cust.phone || '';
                    const totalSess = Number(sub.total_sessions || 0);
                    const usedSess = Number(sub.used_sessions || 0);
                    const progressPercent =
                      totalSess > 0 ? Math.min(100, (usedSess / totalSess) * 100) : 0;
                    const st = String(
                      sub.status || sub.effective_status || 'active'
                    ).toLowerCase();

                    return (
                      <div
                        key={sub.id}
                        className="p-4 rounded-2xl border transition-all hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        style={{ background: B.cardBg, borderColor: B.linen }}
                      >
                        {/* Customer Info */}
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border"
                            style={{
                              background: B.pillBg,
                              color: B.espresso,
                              borderColor: B.linen,
                            }}
                          >
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-sm text-[#2C241D]">{custName}</h5>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  st === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : st === 'payment_pending'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : st === 'exhausted'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : st === 'expired'
                                    ? 'bg-gray-100 text-gray-600 border-gray-200'
                                    : 'bg-red-50 text-red-600 border-red-200'
                                }`}
                              >
                                {st.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#8C7D70] mt-0.5">
                              {custPhone && (
                                <span className="inline-flex items-center gap-1 font-mono">
                                  <Phone className="w-3 h-3" />
                                  {custPhone}
                                </span>
                              )}
                              <span
                                className="font-mono text-[11px]"
                                style={{ color: B.espresso }}
                              >
                                {sub.subscription_number}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress and Dates */}
                        <div className="flex items-center gap-4 text-xs sm:text-right shrink-0">
                          <div>
                            <div className="font-semibold text-[#2C241D]">
                              {usedSess} of {totalSess} sessions used
                            </div>
                            {/* Progress bar */}
                            <div className="w-28 h-1.5 rounded-full bg-[#E5E0D8] mt-1 overflow-hidden ml-auto">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${progressPercent}%`,
                                  background: B.espresso,
                                }}
                              />
                            </div>
                            <div className="text-[10px] text-[#8C7D70] mt-1">
                              Purchased: {formatDate(sub.purchased_at || sub.created_at)}
                            </div>
                          </div>

                          <Link
                            href={`/bookings/course-subscriptions?search=${encodeURIComponent(
                              sub.subscription_number
                            )}`}
                            title="View in Subscriptions"
                            className="p-2 rounded-xl text-[#8C7D70] hover:text-[#543C30] hover:bg-[#FAF8F5] border border-transparent hover:border-[#E5E0D8] transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-3 border-t flex justify-end shrink-0"
              style={{ background: B.bg, borderColor: B.linen }}
            >
              <button
                type="button"
                onClick={() => {
                  setCustomersModalOpen(false);
                  setSelectedCourseForCustomers(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-95 cursor-pointer"
                style={{ background: B.espresso }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl border w-full max-w-2xl overflow-hidden"
            style={{ borderColor: B.linen }}
          >
            {/* Modal Title Bar with #543C30 */}
            <div
              className="flex items-center justify-between px-6 py-4 text-white"
              style={{ background: B.espresso }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <Layers className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingCourse ? `Edit Course (${editingCourse.code})` : 'Create New Course'}
                  </h3>
                  <p className="text-xs" style={{ color: B.linen }}>
                    Define locked service, room arrangement, session count, and package price
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-white hover:bg-white/20 transition cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCourse}
              className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
              style={{ background: B.bg }}
            >
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="CRS-THAI-06"
                    className="w-full px-3.5 py-2.5 rounded-xl border font-mono text-sm bg-white text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        status: e.target.value as 'active' | 'inactive' | 'draft',
                      }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, display_order: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Course Name (English) *
                  </label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData((p) => ({ ...p, name_en: e.target.value }))}
                    placeholder="e.g. 6-Session Royal Thai Massage Course"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Course Name (Arabic)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.name_ar}
                    onChange={(e) => setFormData((p) => ({ ...p, name_ar: e.target.value }))}
                    placeholder="مثال: باقة المساج التايلاندي الملكي 6 جلسات"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                  />
                </div>
              </div>

              {/* Service & Room Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Locked Service *
                  </label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => setFormData((p) => ({ ...p, service_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  >
                    <option value="">Select Service...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.duration_minutes ? `(${s.duration_minutes}m)` : ''}{' '}
                        {s.base_price ? `· ${Number(s.base_price).toFixed(3)} KWD` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Locked Room Arrangement *
                  </label>
                  <select
                    value={formData.arrangement_type}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, arrangement_type: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  >
                    {ARRANGEMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sessions, Validity, Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Total Sessions *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.total_sessions}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, total_sessions: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Validity (Days) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={formData.validity_days}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, validity_days: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      className="block text-xs font-extrabold uppercase tracking-wider"
                      style={{ color: B.espresso }}
                    >
                      Package Price (KWD) *
                    </label>
                    {selectedServiceObj?.base_price && (
                      <button
                        type="button"
                        onClick={handleAutoCalculatePrice}
                        className="text-[11px] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                        style={{ color: B.espresso }}
                      >
                        <Calculator className="w-3 h-3" />
                        Unit × {formData.total_sessions}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                    placeholder="120.000"
                    className="w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                    required
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Description (English)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description_en}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description_en: e.target.value }))
                    }
                    placeholder="Package details and terms..."
                    className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs font-extrabold uppercase tracking-wider mb-1"
                    style={{ color: B.espresso }}
                  >
                    Description (Arabic)
                  </label>
                  <textarea
                    rows={2}
                    dir="rtl"
                    value={formData.description_ar}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description_ar: e.target.value }))
                    }
                    placeholder="تفاصيل وشروط الباقة..."
                    className="w-full px-3.5 py-2 rounded-xl border bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#543C30]"
                    style={{ borderColor: B.linen }}
                  />
                </div>
              </div>

              <div
                className="flex items-center justify-end gap-3 pt-3 border-t"
                style={{ borderColor: B.linen }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border bg-white text-sm font-semibold cursor-pointer"
                  style={{ borderColor: B.linen, color: B.textMain }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                  style={{ background: B.espresso }}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  {editingCourse ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
