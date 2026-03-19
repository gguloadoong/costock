/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@coinbase/cds-web', '@coinbase/cds-common', '@coinbase/cds-icons'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL
    if (!apiUrl) return []
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
