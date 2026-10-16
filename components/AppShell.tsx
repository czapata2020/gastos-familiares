'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BarChart3, Home, ListChecks, Settings } from 'lucide-react'

const NAV = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/registrar', label: 'Registrar', icon: ListChecks },
  { href: '/metricas', label: 'Métricas', icon: BarChart3 },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const p = useSearchParams().get('p')
  const q = p ? `?p=${p}` : ''

  // Páginas públicas (sin login): sin menú de la app
  if (pathname.startsWith('/publico')) {
    return <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-6" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>{children}</main>
  }

  return (
    <div className="min-h-dvh md:pl-56">
      {/* Escritorio: barra lateral */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-surface px-3 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-3">
          <Logo />
          <span className="font-display text-lg font-bold leading-none">Gastos<br /><span className="text-sm font-medium text-ink-3">familiares</span></span>
        </div>
        <nav className="grid gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const activo = pathname === href
            return (
              <Link key={href} href={href + q}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  activo ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'}`}>
                <Icon className="h-[18px] w-[18px]" strokeWidth={activo ? 2.3 : 1.9} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))] md:px-8 md:pb-12 md:pt-8"
        style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}>
        {children}
      </main>

      {/* Celular: barra inferior */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const activo = pathname === href
          return (
            <Link key={href} href={href + q}
              className={`grid justify-items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold ${activo ? 'text-accent' : 'text-ink-3'}`}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={activo ? 2.3 : 1.9} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path d="M9 21.5V12a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9.5" className="stroke-accent-ink" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M16 10v13.5M9 23.5h14" className="stroke-accent-ink" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
