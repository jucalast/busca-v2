import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/growth/:path*',
        destination: 'http://127.0.0.1:8000/api/v1/growth/:path*'
      }
    ]
  }
};

export default nextConfig;
