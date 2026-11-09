import type { NextRequest } from 'next/server';

import { cachedVoucherGet } from '@/lib/voucherProxy';

export const dynamic = 'force-dynamic';

/** GET /booknpay/api/v1/vouchers/creators — distinct voucher creators (cached 5 min). */
export async function GET(req: NextRequest) {
  return cachedVoucherGet(req, '/api/v1/vouchers/creators/', 300);
}
