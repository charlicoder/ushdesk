import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  skipTrailingSlashRedirect: true,
  env: {
    API_BASE_URL: process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://apidev.ushspa.co',
    API_APP_TOKEN: process.env.API_APP_TOKEN || 'ushspa',
    API_UAUTH: process.env.API_UAUTH || '/uauth',
    API_BOOKNPAY: process.env.API_BOOKNPAY || '/booknpay',
    API_NOTICE: process.env.API_NOTICE || '/unotice',
    API_UANR: process.env.API_UANR || '/uanr',
    USHWEB: process.env.USHWEB || process.env.NEXT_PUBLIC_USHWEB || 'http://127.0.0.1:3001',
  },

  async rewrites() {
    // Reads from environment variables injected at runtime (Amplify, Docker, local .env).
    // Fallback to localhost only for local development.
    const rawBaseUrl = (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://apidev.ushspa.co'
    ).replace(/\/+$/, '');

    const uauth    = (process.env.API_UAUTH    || '/uauth').replace(/\/+$/, '');
    const booknpay = (process.env.API_BOOKNPAY || '/booknpay').replace(/\/+$/, '');

    // Allow explicit direct-service URL overrides (bypasses Kong/gateway).
    // Set these when running ushdesk in Docker alongside the microservices:
    //   DIRECT_UAUTH_URL=http://ushauth:8002
    //   DIRECT_BOOKNPAY_URL=http://ushbooknpay:8003
    // Or locally without Kong:
    //   DIRECT_UAUTH_URL=http://127.0.0.1:8002
    //   DIRECT_BOOKNPAY_URL=http://127.0.0.1:8003
    const directUauthBase    = (process.env['DIRECT_UAUTH_URL']    || '').replace(/\/+$/, '');
    const directBooknpayBase = (process.env['DIRECT_BOOKNPAY_URL'] || '').replace(/\/+$/, '');

    const uauthDest    = directUauthBase    ? `${directUauthBase}/api/:path*`    : `${rawBaseUrl}${uauth}/api/:path*`;
    const booknpayDest = directBooknpayBase ? `${directBooknpayBase}/api/:path*` : `${rawBaseUrl}${booknpay}/api/:path*`;

    return {
      fallback: [
        // Booking & payment proxy  →  gateway or direct booknpay service
        {
          source: '/booknpay/api/:path*',
          destination: booknpayDest,
        },
        // Auth & user management proxy  →  gateway or direct ushauth service
        {
          source: '/uauth/api/:path*',
          destination: uauthDest,
        },
      ],
    };
  },

  async headers() {
    return [
      {
        // Allow browsers to call /api/* proxy routes from any origin.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/booknpay/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/uanr/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

};

export default nextConfig;
