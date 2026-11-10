import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { cn } from '../../utils/cn'

export default function Layout() {
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless mobileOpen */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 md:relative md:block',
          mobileOpen ? 'block' : 'hidden md:block'
        )}
      >
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMobileMenuToggle={() => setMobileOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
