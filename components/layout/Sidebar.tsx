'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/',                label: 'Resumen',            icon: '📊' },
  { href: '/transversales',   label: 'Gastos fijos',       icon: '🔁' },
  { href: '/servicios',       label: 'Servicios',          icon: '💡' },
  { href: '/historial',       label: 'Historial',          icon: '📋' },
  { href: '/configuracion',   label: 'Configuración',      icon: '⚙️'  },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <span className="text-lg font-bold text-brand-700">💰 Gastos</span>
        <span className="text-lg font-bold text-gray-700"> Familiares</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-gray-100 text-xs text-gray-400">
        v0.1 · Google Sheets
      </div>
    </aside>
  )
}
