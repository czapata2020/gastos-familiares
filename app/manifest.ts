import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gastos Familiares',
    short_name: 'Gastos',
    description: 'Gastos compartidos del hogar, repartidos por salario',
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
