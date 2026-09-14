import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const baseUrl = (
      process.env.BASE_TRACE_API_URL ||
      process.env.NEXT_PUBLIC_BASE_TRACE_API_URL ||
      'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');

    return [
      {
        source: '/booknpay/api/:path*',
        destination: `${baseUrl}/booknpay/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        // Apply CORS headers to the Next.js API proxy routes so that browsers
        // don't block responses when the front-end is served from a different
        // origin (e.g. during staging or behind a CDN in production).
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://apidev.ushspa.co' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // Prevent Next.js CSRF check from rejecting server-side requests that
  // originate from the production API domain or a CDN / reverse proxy.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#allowedorigins
  experimental: {
    serverActions: {
      allowedOrigins: [
        "api.ushspa.co",
        "apidev.ushspa.co",
        "main.d1w1ttnk2s5c9c.amplifyapp.com",
      ],
    },
  },
};

export default nextConfig;

