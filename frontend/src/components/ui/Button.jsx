import React from 'react'
import { cn } from '../../utils/cn'
import Spinner from './Spinner'

const variantStyles = {
  default:   'bg-primary-600 hover:bg-primary-700 text-white shadow-sm',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  outline:   'border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white',
  ghost:     'hover:bg-slate-100 text-slate-700',
  danger:    'bg-rose-600 hover:bg-rose-700 text-white shadow-sm',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm',
  warning:   'bg-amber-500 hover:bg-amber-600 text-white shadow-sm',
}

const sizeStyles = {
  xs: 'h-7  px-2.5 text-xs  gap-1',
  sm: 'h-8  px-3   text-sm  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
  lg: 'h-11 px-5   text-base gap-2',
}

export default function Button({
  children,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon = null,
  iconRight: IconRight = null,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-lg',
        'transition-all duration-200 focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size] || sizeStyles.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" className={cn(variant === 'default' || variant === 'danger' ? 'text-white' : 'text-slate-600')} />
      ) : Icon ? (
        <Icon className={cn('shrink-0', size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      ) : null}
      {children && <span>{children}</span>}
      {!loading && IconRight && (
        <IconRight className={cn('shrink-0', size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      )}
    </button>
  )
}
