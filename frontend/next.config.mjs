/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/agent/:path*',
        destination: `${process.env.AGENT_URL ?? 'http://localhost:3002'}/api/agent/:path*`,
      },
    ];
  },
};

export default nextConfig;
