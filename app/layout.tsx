import type { Metadata } from 'next'
import './globals.css'
import SidebarLayout from '@/components/layout/SidebarLayout'

export const metadata: Metadata = {
  title: 'Gastos Familiares',
  description: 'Gestión de gastos compartidos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SidebarLayout>{children}</SidebarLayout>
      </body>
    </html>
  )
}
