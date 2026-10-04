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
  },

  async rewrites() {
    // Reads from Amplify environment variables.
    // Fallback to localhost only for local development.
    const baseUrl = (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://apidev.ushspa.co'
    ).replace(/\/+$/, '');

    const uauth    = (process.env.API_UAUTH    || '/uauth').replace(/\/+$/, '');
    const booknpay = (process.env.API_BOOKNPAY || '/booknpay').replace(/\/+$/, '');
    const uanr     = (process.env.API_UANR     || '/uanr').replace(/\/+$/, '');

    return {
      fallback: [
        // Auth service proxy  →  https://apidev.ushspa.co/uauth/api/v1/auth/:path*
        {
          source: '/api/v1/auth/:path*',
          destination: `${baseUrl}${uauth}/api/v1/auth/:path*`,
        },
        // Booking & payment proxy  →  https://apidev.ushspa.co/booknpay/api/:path*
        {
          source: '/booknpay/api/:path*',
          destination: `${baseUrl}${booknpay}/api/:path*`,
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
