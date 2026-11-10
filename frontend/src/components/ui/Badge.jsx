import React from 'react'
import { cn } from '../../utils/cn'

const variantStyles = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50  text-amber-700  ring-amber-200',
  danger:  'bg-rose-50   text-rose-700   ring-rose-200',
  info:    'bg-blue-50   text-blue-700   ring-blue-200',
  neutral: 'bg-slate-100 text-slate-600  ring-slate-200',
  primary: 'bg-primary-50 text-primary-700 ring-primary-200',
}

const sizeStyles = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1',
}

export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full ring-1',
        variantStyles[variant] || variantStyles.neutral,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            {
              'bg-emerald-500': variant === 'success',
              'bg-amber-500':   variant === 'warning',
              'bg-rose-500':    variant === 'danger',
              'bg-blue-500':    variant === 'info',
              'bg-slate-400':   variant === 'neutral',
              'bg-primary-500': variant === 'primary',
            }
          )}
        />
      )}
      {children}
    </span>
  )
}
