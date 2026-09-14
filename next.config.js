/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },

  async rewrites() {
    const baseUrl = (
      process.env.API_BASE_URL ||
      process.env.BASE_TRACE_API_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_TRACE_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");

    return [
      {
        source: "/api/v1/auth/:path*",
        destination: `${baseUrl}/uauth/api/v1/auth/:path*`,
      },
      {
        source: "/booknpay/api/:path*",
        destination: `${baseUrl}/booknpay/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },

  experimental: {
    serverActions: {
      allowedOrigins: [
        "main.d1w1ttnk2s5c9c.amplifyapp.com",
        "apidev.ushspa.co",
      ],
    },
  },
};

module.exports = nextConfig;



