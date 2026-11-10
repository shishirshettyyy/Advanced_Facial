import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../utils/cn'

const colorMap = {
  blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-500',    text: 'text-blue-600'    },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-500', text: 'text-emerald-600' },
  amber:   { bg: 'bg-amber-50',   icon: 'bg-amber-500',   text: 'text-amber-600'   },
  rose:    { bg: 'bg-rose-50',    icon: 'bg-rose-500',    text: 'text-rose-600'    },
  violet:  { bg: 'bg-violet-50',  icon: 'bg-violet-500',  text: 'text-violet-600'  },
  slate:   { bg: 'bg-slate-50',   icon: 'bg-slate-500',   text: 'text-slate-600'   },
  cyan:    { bg: 'bg-cyan-50',    icon: 'bg-cyan-500',    text: 'text-cyan-600'    },
}

function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <div className="h-3.5 w-24 bg-slate-200 rounded" />
          <div className="h-8 w-16 bg-slate-200 rounded" />
        </div>
        <div className="w-11 h-11 bg-slate-200 rounded-xl" />
      </div>
      <div className="h-3.5 w-20 bg-slate-200 rounded" />
    </div>
  )
}

/**
 * Dashboard stat card with icon, value, and trend indicator.
 */
export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  changeLabel,
  changeType, // 'up' | 'down' | 'neutral'
  color = 'blue',
  suffix = '',
  loading = false,
}) {
  if (loading) return <SkeletonStatCard />

  const colors = colorMap[color] || colorMap.blue

  const TrendIcon =
    changeType === 'up'   ? TrendingUp   :
    changeType === 'down' ? TrendingDown :
    Minus

  const trendColor =
    changeType === 'up'   ? 'text-emerald-600' :
    changeType === 'down' ? 'text-rose-600'    :
    'text-slate-400'

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-card p-5 hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-slate-900 leading-none">
            {value !== undefined && value !== null ? (
              <>
                {value}
                {suffix && <span className="text-lg font-medium text-slate-500 ml-0.5">{suffix}</span>}
              </>
            ) : (
              <span className="text-slate-300">—</span>
            )}
          </p>
        </div>
        {Icon && (
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colors.icon)}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>

      {(change !== undefined || changeLabel) && (
        <div className="flex items-center gap-1.5">
          <TrendIcon className={cn('w-3.5 h-3.5', trendColor)} />
          {change !== undefined && (
            <span className={cn('text-xs font-semibold', trendColor)}>
              {change > 0 ? '+' : ''}{change}%
            </span>
          )}
          {changeLabel && (
            <span className="text-xs text-slate-400">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
