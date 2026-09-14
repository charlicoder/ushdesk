import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },

  async rewrites() {
    // Reads from Amplify environment variables.
    // Fallback to localhost only for local development.
    const baseUrl = (
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'http://127.0.0.1:8000'
    ).replace(/\/+$/, '');

    const uauth    = (process.env.API_UAUTH    || '/uauth').replace(/\/+$/, '');
    const booknpay = (process.env.API_BOOKNPAY || '/booknpay').replace(/\/+$/, '');

    return [
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
    ];
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
    ];
  },

  // Prevent Next.js CSRF check from blocking server-side requests from these origins.
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'api.ushspa.co',
        'apidev.ushspa.co',
        'main.d1w1ttnk2s5c9c.amplifyapp.com',
      ],
    },
  },
};

export default nextConfig;
