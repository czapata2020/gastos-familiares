import type { Metadata } from 'next'
import './globals.css'
import SidebarLayout from '@/components/layout/SidebarLayout'
import { auth } from '@/auth'

export const metadata: Metadata = {
  title: 'Gastos Familiares',
  description: 'Gestión de gastos compartidos',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang="es">
      <body>
        {session?.user ? (
          <SidebarLayout user={session.user}>{children}</SidebarLayout>
        ) : (
          children
        )}
      </body>
    </html>
  )
}
