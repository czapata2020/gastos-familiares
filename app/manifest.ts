import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cuentas Claras',
    short_name: 'Cuentas Claras',
    description: 'Los gastos del hogar, repartidos según el ingreso de cada uno',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f5f4',
    theme_color: '#0f6b5c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
