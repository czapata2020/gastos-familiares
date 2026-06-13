import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Gastos Familiares',
  description: 'Gestión de gastos compartidos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-60 p-8 max-w-5xl">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
