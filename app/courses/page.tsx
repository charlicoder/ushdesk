'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DashboardShell } from '@/components/dashboard/shell';
import { authedFetch } from '@/lib/fetcher';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
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
      const [coursesRes, servicesRes] = await Promise.all([
        authedFetch('/api/v1/courses?all=true'),
        authedFetch('/api/v1/services'),
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

      setCourses(courseList);
      setServices(serviceList);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to fetch courses.');
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <DashboardShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#2C241D] text-[#C5A059] flex items-center justify-center shadow-sm">
                <Layers className="w-5 h-5" />
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
              className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm font-medium text-[#2C241D] hover:bg-[#FAF8F5] flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/bookings/course-subscriptions"
              className="px-4 py-2.5 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#7C5E24] text-sm font-semibold hover:bg-[#C5A059]/20 flex items-center gap-2 transition-colors"
            >
              <BookMarked className="w-4 h-4" />
              Subscriptions
            </Link>
            {canEdit && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-semibold hover:bg-[#3F342A] flex items-center gap-2 shadow-sm transition-colors"
              >
                <Plus className="w-4 h-4 text-[#C5A059]" />
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
              <Layers className="w-4 h-4 text-[#C5A059]" />
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
              <Sparkles className="w-4 h-4 text-[#C5A059]" />
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="draft">Draft</option>
          </select>

          <select
            value={arrangementFilter}
            onChange={(e) => setArrangementFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
              <Loader2 className="w-7 h-7 animate-spin text-[#C5A059]" />
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
                  className="mt-2 px-4 py-2 rounded-xl bg-[#2C241D] text-white text-xs font-semibold hover:bg-[#3F342A] inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#C5A059]" />
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
                    <th className="py-3.5 px-4">Sessions</th>
                    <th className="py-3.5 px-4">Validity</th>
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
                            <span className="px-2 py-0.5 rounded-md bg-[#2C241D] text-[#C5A059] font-mono text-xs font-semibold">
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
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#C5A059]/15 text-[#7C5E24] border border-[#C5A059]/30">
                            {course.arrangement_type_label ||
                              ARRANGEMENT_LABELS[course.arrangement_type] ||
                              course.arrangement_type}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="font-bold text-[#2C241D]">
                            {course.total_sessions}
                          </span>{' '}
                          <span className="text-xs text-[#6E6259]">sessions</span>
                        </td>

                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4A3F35]">
                            <Clock className="w-3.5 h-3.5 text-[#8C7D70]" />
                            {course.validity_days} days
                          </span>
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
                              <Link
                                href={`/bookings/course-subscriptions?sell_course_id=${course.id}`}
                                className="px-2.5 py-1.5 rounded-lg bg-[#C5A059]/15 text-[#7C5E24] hover:bg-[#C5A059]/25 text-xs font-semibold transition-colors"
                              >
                                Sell
                              </Link>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => openEditModal(course)}
                                  title="Edit Course"
                                  className="p-1.5 rounded-lg text-[#6E6259] hover:text-[#2C241D] hover:bg-[#FAF8F5] transition-colors"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(course)}
                                  title={
                                    course.status === 'active' ? 'Deactivate' : 'Activate'
                                  }
                                  className="p-1.5 rounded-lg text-[#6E6259] hover:text-[#2C241D] hover:bg-[#FAF8F5] transition-colors"
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
                                  className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
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

      {/* Create / Edit Course Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#E5E0D8] w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#2C241D] to-[#43362B] text-white">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {editingCourse ? `Edit Course (${editingCourse.code})` : 'Create New Course'}
                  </h3>
                  <p className="text-xs text-white/70">
                    Define locked service, room arrangement, session count, and package price
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveCourse}
              className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                    }
                    placeholder="CRS-THAI-06"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] font-mono text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, display_order: Number(e.target.value) }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Course Name (English) *
                  </label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData((p) => ({ ...p, name_en: e.target.value }))}
                    placeholder="e.g. 6-Session Royal Thai Massage Course"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Course Name (Arabic)
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={formData.name_ar}
                    onChange={(e) => setFormData((p) => ({ ...p, name_ar: e.target.value }))}
                    placeholder="كورس المساج التايلندي الملكي - ٦ جلسات"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  />
                </div>
              </div>

              {/* Service & Arrangement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Locked Service *
                  </label>
                  <select
                    value={formData.service_id}
                    onChange={(e) => setFormData((p) => ({ ...p, service_id: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  >
                    <option value="">Select Service...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.name_en} ({s.duration_minutes}m · {s.base_price} KWD)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Locked Room / Arrangement Type *
                  </label>
                  <select
                    value={formData.arrangement_type}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, arrangement_type: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] bg-white text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
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
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-[#4A3F35]">
                      Package Price (KWD) *
                    </label>
                    {selectedServiceObj?.base_price && (
                      <button
                        type="button"
                        onClick={handleAutoCalculatePrice}
                        className="text-[11px] text-[#7C5E24] hover:underline inline-flex items-center gap-1"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                    required
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
                    Description (English)
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description_en}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, description_en: e.target.value }))
                    }
                    placeholder="Package details and terms..."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#4A3F35] mb-1">
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
                    className="w-full px-3.5 py-2 rounded-xl border border-[#E5E0D8] text-sm text-[#2C241D] focus:outline-none focus:ring-2 focus:ring-[#C5A059]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E0D8]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E5E0D8] text-sm font-medium text-[#6E6259] hover:bg-[#FAF8F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#2C241D] text-white text-sm font-semibold hover:bg-[#3F342A] disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
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
