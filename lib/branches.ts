/**
 * Utilities for normalizing branch names across USHDesk.
 * Handles Arabic variations, English casing, and ensures consistent reporting and display.
 */

const KNOWN_BRANCH_NAMES: Record<string, string> = {
  // Arabic names
  'فرع شرق': 'Sharq Branch',
  'شرق': 'Sharq Branch',
  'فرع المنقف': 'Mangaf Branch',
  'فرع منقف': 'Mangaf Branch',
  'المنقف': 'Mangaf Branch',
  'منقف': 'Mangaf Branch',
  'فرع المهبولة': 'Mahboula Branch',
  'المهبولة': 'Mahboula Branch',
  'مهبولة': 'Mahboula Branch',
  'فرع حولي': 'Hawally Branch',
  'حولي': 'Hawally Branch',
  'فرع السالمية': 'Salmiya Branch',
  'السالمية': 'Salmiya Branch',

  // English variations
  'sharq': 'Sharq Branch',
  'sharq branch': 'Sharq Branch',
  'mangaf': 'Mangaf Branch',
  'mangaf branch': 'Mangaf Branch',
  'mahboula': 'Mahboula Branch',
  'mahboula branch': 'Mahboula Branch',
  'hawally': 'Hawally Branch',
  'hawally branch': 'Hawally Branch',
  'salmiya': 'Salmiya Branch',
  'salmiya branch': 'Salmiya Branch',
};

export function normalizeBranchName(name?: string | null): string {
  const s = String(name ?? '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (KNOWN_BRANCH_NAMES[lower]) return KNOWN_BRANCH_NAMES[lower];
  if (KNOWN_BRANCH_NAMES[s]) return KNOWN_BRANCH_NAMES[s];

  // Arabic heuristics
  if (s.includes('شرق')) return 'Sharq Branch';
  if (s.includes('منقف') || s.includes('المنقف')) return 'Mangaf Branch';
  if (s.includes('مهبولة') || s.includes('المهبولة')) return 'Mahboula Branch';
  if (s.includes('حولي')) return 'Hawally Branch';
  if (s.includes('سالمية') || s.includes('السالمية')) return 'Salmiya Branch';

  // English heuristics
  if (/sharq/i.test(s)) return 'Sharq Branch';
  if (/mangaf/i.test(s)) return 'Mangaf Branch';
  if (/mahboula/i.test(s)) return 'Mahboula Branch';
  if (/hawall?y/i.test(s)) return 'Hawally Branch';
  if (/salmiya/i.test(s)) return 'Salmiya Branch';

  return s;
}

export function voucherBranchName(v: {
  branch_id?: string | null;
  branch_data?: { name?: string | null; name_en?: string | null; branch_name?: string | null; id?: string | null } | null;
}): string {
  const bd = v.branch_data as any;
  if (bd?.name_en && !/[\u0600-\u06FF]/.test(bd.name_en)) {
    return normalizeBranchName(bd.name_en);
  }
  const raw = bd?.name || bd?.branch_name || '';
  const normalized = normalizeBranchName(raw);
  if (normalized) return normalized;
  return 'Unassigned';
}

