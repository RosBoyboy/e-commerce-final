/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: '',
  },
  async redirects() {
    return [
      { source: '/dashboard/seller', destination: '/dashboard/admin', permanent: false },
      { source: '/dashboard/seller/:path*', destination: '/dashboard/admin', permanent: false },
    ];
  },
};

module.exports = nextConfig;
