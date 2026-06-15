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

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()
  return (
    <aside
      className={`fixed inset-y-0 left-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div
        className={`border-b border-gray-100 flex items-center ${
          collapsed ? 'justify-center py-5' : 'px-6 py-5'
        }`}
      >
        {collapsed ? (
          <span className="text-xl">💰</span>
        ) : (
          <>
            <span className="text-lg font-bold text-brand-700">💰 Gastos</span>
            <span className="text-lg font-bold text-gray-700"> Familiares</span>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-base leading-none">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer + Toggle */}
      <div className="border-t border-gray-100">
        {!collapsed && (
          <div className="px-5 py-3 text-xs text-gray-400">v0.1 · Google Sheets</div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-full flex items-center justify-center py-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <span className="text-lg leading-none">{collapsed ? '›' : '‹'}</span>
        </button>
      </div>
    </aside>
  )
}
