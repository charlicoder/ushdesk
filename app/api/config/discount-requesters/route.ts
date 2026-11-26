import { NextResponse } from 'next/server';
import { parseDiscountRequesters } from '@/lib/discount';

export const dynamic = 'force-dynamic';

export async function GET() {
  const raw =
    process.env.DISCOUNT_REQUESTED_BY ||
    process.env.NEXT_PUBLIC_DISCOUNT_REQUESTED_BY ||
    '';
  const requesters = parseDiscountRequesters(raw);
  return NextResponse.json({ requesters });
}
