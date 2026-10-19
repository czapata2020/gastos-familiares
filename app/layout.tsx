import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Figtree } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import AppShell from '@/components/AppShell'

const display = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display' })
const body = Figtree({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Cuentas Claras',
  description: 'Los gastos del hogar, repartidos según el ingreso de cada uno',
  appleWebApp: { capable: true, title: 'Cuentas Claras', statusBarStyle: 'default' },
  // Íconos y manifiesto en /publico: el celular los pide sin sesión, así que no pueden pasar por Cloudflare Access
  manifest: '/publico/manifest.webmanifest',
  icons: {
    icon: [{ url: '/publico/icono?tam=32', sizes: '32x32', type: 'image/png' }, { url: '/publico/icono?tam=192', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/publico/icono?tam=180', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1110' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  )
}
