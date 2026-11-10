import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, Wifi, WifiOff, ChevronDown, User, LogOut, Settings, Menu } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useAuthStore } from '../../stores/authStore'
import { useSocketStore } from '../../stores/socketStore'

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/monitoring':      'Live CCTV Monitoring',
  '/sessions':        'Live Attendance',
  '/students':        'Students',
  '/face-enrollment': 'Face Enrollment',
  '/cameras':         'Cameras',
  '/classes':         'Classes',
  '/subjects':        'Subjects',
  '/attendance':      'Attendance History',
  '/reports':         'Reports & Analytics',
  '/settings':        'System Settings',
}

export default function Header({ onMobileMenuToggle, unknownFaceCount = 0 }) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const { isConnected } = useSocketStore()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const pageTitle = PAGE_TITLES[location.pathname] || 'Smart Attendance'

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
  }

  return (
    <header className="h-14 bg-white border-b border-slate-100 flex items-center justify-between px-5 shrink-0 shadow-sm z-10">
      {/* Left: Mobile menu + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-slate-900">{pageTitle}</h1>
        </div>
      </div>

      {/* Right: indicators + user */}
      <div className="flex items-center gap-2">
        {/* Socket status */}
        <div
          className={cn(
            'hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium',
            isConnected
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          )}
          title={isConnected ? 'Real-time connection active' : 'Disconnected'}
        >
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
          )} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
          <Bell className="w-5 h-5" />
          {unknownFaceCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {unknownFaceCount > 9 ? '9+' : unknownFaceCount}
            </span>
          )}
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
              {user?.name || user?.email}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-1 animate-slide-in">
                <div className="px-3 py-2 border-b border-slate-50 mb-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
