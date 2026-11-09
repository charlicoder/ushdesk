import { NextResponse } from 'next/server';

import { invalidateVoucherCache } from '@/lib/voucherProxy';

export const dynamic = 'force-dynamic';

/** POST /booknpay/api/v1/vouchers/cache/revalidate — drop the cached voucher list / stats / details after a change. */
export async function POST() {
  invalidateVoucherCache();
  return NextResponse.json({ ok: true });
}
