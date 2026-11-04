/**
 * Branch scoping for branch-assigned employees.
 *
 * When the logged-in employee is assigned to a branch, the branch is persisted
 * in localStorage (`ush_branch_id` / `ush_branch_name`) and a `branch_id` query
 * param is added to list/read API requests for branch-owned data (bookings,
 * payments, refunds, employees, working hours, leaves, schedules).
 * Employees with no assigned branch are not scoped and see every branch.
 */

export const BRANCH_ID_KEY = 'ush_branch_id';
export const BRANCH_NAME_KEY = 'ush_branch_name';

/** Persist (or clear) the employee's assigned branch. */
export function persistAssignedBranch(branchId?: string | null, branchName?: string | null): void {
  if (typeof window === 'undefined') return;
  if (branchId) {
    localStorage.setItem(BRANCH_ID_KEY, String(branchId));
    if (branchName) localStorage.setItem(BRANCH_NAME_KEY, String(branchName));
  } else {
    localStorage.removeItem(BRANCH_ID_KEY);
    localStorage.removeItem(BRANCH_NAME_KEY);
  }
}

export function clearAssignedBranch(): void {
  persistAssignedBranch(null, null);
}

/** Returns the assigned branch id, or null when the employee is not branch-scoped. */
export function getAssignedBranchId(): string | null {
  if (typeof window === 'undefined') return null;
  const v = localStorage.getItem(BRANCH_ID_KEY);
  return v && v !== 'null' && v !== 'undefined' ? v : null;
}

export function getAssignedBranchName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(BRANCH_NAME_KEY) || null;
}

/**
 * Same-origin GET list endpoints whose data is branch-owned.
 * Detail endpoints (with an id segment) are intentionally not matched.
 */
const SCOPED_PATHS: RegExp[] = [
  /^\/booknpay\/api\/v1\/bookings$/,
  /^\/booknpay\/api\/v1\/payments$/,
  /^\/booknpay\/api\/v1\/refunds$/,
  /^\/api\/v1\/bookings$/,
  /^\/api\/v1\/payments$/,
  /^\/api\/v1\/employees$/,
  /^\/api\/v1\/employees\/leaves$/,
  /^\/uauth\/api\/v1\/employees\/leaves$/,
  /^\/api\/v1\/therapists\/working-hours$/,
  /^\/uauth\/api\/v1\/therapists\/working-hours$/,
  /^\/api\/v1\/therapists\/extra-hours$/,
  /^\/uauth\/api\/v1\/therapists\/extra-hours$/,
  /^\/api\/v1\/therapists\/break-time$/,
  /^\/uauth\/api\/v1\/therapists\/break-time$/,
  /^\/api\/v1\/therapists\/schedule$/,
  /^\/api\/v1\/service-arrangements\/schedule$/,
];

/**
 * Returns `input` with `branch_id` set to the employee's assigned branch when
 * the request is a scoped GET; otherwise returns `input` unchanged.
 * `branch_id=home` (home-service schedule) is left untouched.
 */
export function applyBranchScope(input: RequestInfo | URL, init?: RequestInit): RequestInfo | URL {
  const branchId = getAssignedBranchId();
  if (!branchId || typeof window === 'undefined') return input;

  const method = (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'GET') return input;
  if (typeof Request !== 'undefined' && input instanceof Request) return input;

  let url: URL;
  try {
    url = new URL(typeof input === 'string' ? input : input.toString(), window.location.origin);
  } catch {
    return input;
  }
  if (url.origin !== window.location.origin) return input;

  const path = url.pathname.replace(/\/+$/, '');
  if (!SCOPED_PATHS.some((re) => re.test(path))) return input;

  if (url.searchParams.get('branch_id') === 'home') return input;
  url.searchParams.set('branch_id', branchId);
  url.searchParams.delete('branch');

  return typeof input === 'string' && input.startsWith('/')
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

