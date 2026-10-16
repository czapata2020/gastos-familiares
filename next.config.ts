import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  devIndicators: false,
  serverExternalPackages: ['better-sqlite3', 'exceljs'],
  poweredByHeader: false,
}

export default nextConfig
