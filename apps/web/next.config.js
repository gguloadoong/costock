/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@coinbase/cds-web', '@coinbase/cds-common', '@coinbase/cds-icons'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3101'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
