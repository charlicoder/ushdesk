import type { NextRequest } from 'next/server';

import { cachedVoucherGet } from '@/lib/voucherProxy';

export const dynamic = 'force-dynamic';

/** GET /booknpay/api/v1/vouchers/stats — aggregate cards for the current filters (cached 30s). */
export async function GET(req: NextRequest) {
  return cachedVoucherGet(req, '/api/v1/vouchers/stats/', 30);
}
