import React from 'react'
import { cn } from '../../utils/cn'

const sizeStyles = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-4',
}

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'rounded-full border-current border-t-transparent animate-spin',
        sizeStyles[size] || sizeStyles.md,
        !className.includes('text-') && 'text-primary-600',
        className
      )}
    />
  )
}

/** Full-page loading overlay */
export function PageSpinner({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <Spinner size="xl" />
      {message && (
        <p className="mt-4 text-sm text-slate-500 font-medium">{message}</p>
      )}
    </div>
  )
}

/** Inline loading within a container */
export function InlineSpinner({ message = '' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <Spinner size="md" />
      {message && <span className="text-sm text-slate-500">{message}</span>}
    </div>
  )
}
