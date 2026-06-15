'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Repeat2,
  Zap,
  ScrollText,
  Settings2,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const NAV = [
  { href: '/',              label: 'Resumen',        icon: LayoutDashboard },
  { href: '/transversales', label: 'Gastos fijos',   icon: Repeat2         },
  { href: '/servicios',     label: 'Servicios',      icon: Zap             },
  { href: '/historial',     label: 'Historial',      icon: ScrollText      },
  { href: '/configuracion', label: 'Configuración',  icon: Settings2       },
]

interface Props {
  collapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ collapsed, onToggle }: Props) {
  const pathname = usePathname()
  return (
    <aside
      className={`fixed inset-y-0 left-0 bg-brand-500 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div
        className={`border-b border-white/10 flex items-center gap-2.5 ${
          collapsed ? 'justify-center py-5 px-0' : 'px-5 py-5'
        }`}
      >
        <Wallet className="w-5 h-5 text-blush shrink-0" strokeWidth={1.8} />
        {!collapsed && (
          <span className="text-sm font-semibold text-white/90 tracking-wide leading-tight">
            Gastos<br />
            <span className="font-normal text-white/60">Familiares</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
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
                  ? 'bg-terracotta-500 text-white'
                  : 'text-white/65 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2 : 1.75} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer + Toggle */}
      <div className="border-t border-white/10">
        {!collapsed && (
          <div className="px-5 py-3 text-xs text-white/30 tracking-wide">v0.1</div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="w-full flex items-center justify-center py-3 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            : <ChevronLeft  className="w-4 h-4" strokeWidth={1.75} />
          }
        </button>
      </div>
    </aside>
  )
}
