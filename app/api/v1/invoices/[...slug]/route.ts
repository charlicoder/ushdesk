import { NextRequest } from 'next/server';
import { proxyRequest, OPTIONS } from '@/app/uanr/api/v1/[...slug]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, ['invoices', ...slug], 'GET');
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, ['invoices', ...slug], 'POST');
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, ['invoices', ...slug], 'PUT');
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, ['invoices', ...slug], 'PATCH');
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return proxyRequest(req, ['invoices', ...slug], 'DELETE');
}

export { OPTIONS };
