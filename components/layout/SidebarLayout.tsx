'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main
        className={`flex-1 p-8 max-w-5xl transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}
      >
        {children}
      </main>
    </div>
  )
}
