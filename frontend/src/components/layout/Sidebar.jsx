import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Eye,
  LayoutDashboard,
  Video,
  UserCheck,
  Users,
  BookOpen,
  GraduationCap,
  Camera,
  ClipboardList,
  BarChart2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookMarked,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import { useAuthStore } from '../../stores/authStore'
import { useSocketStore } from '../../stores/socketStore'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/monitoring', icon: Video,       label: 'Live CCTV' },
      { to: '/sessions',   icon: UserCheck,   label: 'Live Attendance' },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/students',         icon: Users,          label: 'Students' },
      { to: '/classes',          icon: GraduationCap,  label: 'Classes' },
      { to: '/subjects',         icon: BookOpen,       label: 'Subjects' },
      { to: '/cameras',          icon: Camera,         label: 'Cameras' },
      { to: '/face-enrollment',  icon: Eye,            label: 'Face Enrollment' },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/attendance', icon: ClipboardList, label: 'Attendance History' },
      { to: '/reports',    icon: BarChart2,     label: 'Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuthStore()
  const { disconnect } = useSocketStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    disconnect()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col bg-slate-900 text-slate-100 h-screen',
        'transition-all duration-300 ease-in-out shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-5 border-b border-slate-800 shrink-0',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
          <Eye className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-sm font-bold text-white">Smart Attendance</span>
            <p className="text-[10px] text-slate-400 leading-none mt-0.5">AI Powered</p>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-7 z-10 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors shadow-md"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-slate-400" />
          : <ChevronLeft  className="w-3 h-3 text-slate-400" />
        }
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium',
                        'transition-colors duration-150',
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                        collapsed && 'justify-center px-2'
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className={cn(
        'border-t border-slate-800 p-3 shrink-0',
        collapsed ? 'flex flex-col items-center gap-2' : 'flex items-center gap-2'
      )}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mb-1">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name || user?.email}</p>
            <p className="text-[10px] text-slate-500 truncate capitalize">{user?.role || 'Admin'}</p>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary-700 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        )}
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
