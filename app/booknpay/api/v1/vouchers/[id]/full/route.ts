import type { NextRequest } from 'next/server';

import { cachedVoucherGet } from '@/lib/voucherProxy';

export const dynamic = 'force-dynamic';

/** GET /booknpay/api/v1/vouchers/[id]/full — full voucher details, loaded when a voucher is opened (cached 60s). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return cachedVoucherGet(req, `/api/v1/vouchers/${encodeURIComponent(id)}/full/`, 60);
}
