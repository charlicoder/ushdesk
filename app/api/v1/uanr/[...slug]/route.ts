// Backward compatibility proxy route - forwards to canonical /uanr/api/v1/[...slug]
export { GET, POST, PUT, PATCH, DELETE, OPTIONS } from '@/app/uanr/api/v1/[...slug]/route';
export const dynamic = 'force-dynamic';
