import React from 'react'
import { cn } from '../../utils/cn'

export function Card({ children, className = '', hover = false, ...props }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-100 shadow-card',
        hover && 'transition-shadow duration-200 hover:shadow-card-hover cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={cn('px-5 py-4 border-b border-slate-100', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className = '', description, ...props }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)} {...props}>
      <h3 className="text-base font-semibold text-slate-900">{children}</h3>
      {description && (
        <p className="text-xs text-slate-500">{description}</p>
      )}
    </div>
  )
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={cn('px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl', className)} {...props}>
      {children}
    </div>
  )
}

/** Shorthand: Card with header + content */
export function SimpleCard({ title, description, children, headerRight, className = '', contentClassName = '' }) {
  return (
    <Card className={className}>
      {(title || headerRight) && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle description={description}>{title}</CardTitle>
            {headerRight}
          </div>
        </CardHeader>
      )}
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
