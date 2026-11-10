import React, { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    icon: Icon = null,
    iconRight: IconRight = null,
    type = 'text',
    className = '',
    inputClassName = '',
    id,
    required,
    ...props
  },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="w-4 h-4 text-slate-400" />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          className={cn(
            'w-full rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
            error
              ? 'border-rose-400 focus:ring-rose-400 focus:border-rose-400'
              : 'border-slate-300',
            Icon ? 'pl-9' : 'pl-3',
            IconRight ? 'pr-9' : 'pr-3',
            'py-2 h-9',
            inputClassName
          )}
          {...props}
        />
        {IconRight && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <IconRight className="w-4 h-4 text-slate-400" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-rose-500 flex items-center gap-1">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
})

export default Input


/** Textarea variant */
export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = '', required, id, ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        required={required}
        className={cn(
          'w-full rounded-lg border bg-white text-sm text-slate-900 placeholder:text-slate-400',
          'transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'px-3 py-2',
          error ? 'border-rose-400' : 'border-slate-300'
        )}
        {...props}
      />
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
})

/** Select variant */
export const Select = forwardRef(function Select(
  { label, error, hint, className = '', children, required, id, ...props },
  ref
) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={inputId}
        required={required}
        className={cn(
          'w-full rounded-lg border bg-white text-sm text-slate-900 h-9 px-3',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
          'disabled:bg-slate-50 disabled:cursor-not-allowed',
          error ? 'border-rose-400' : 'border-slate-300'
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-rose-500">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
})
