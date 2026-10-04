import { NextRequest } from 'next/server';
import { proxyRequest, OPTIONS } from '@/app/uanr/api/v1/[...slug]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return proxyRequest(req, ['invoices'], 'GET');
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, ['invoices'], 'POST');
}

export { OPTIONS };
