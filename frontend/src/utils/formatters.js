import { format, parseISO, isValid } from 'date-fns'

/**
 * Safely parse a date value (string | Date | null | undefined)
 */
function parseDate(date) {
  if (!date) return null
  if (date instanceof Date) return isValid(date) ? date : null
  const parsed = typeof date === 'string' ? parseISO(date) : new Date(date)
  return isValid(parsed) ? parsed : null
}

/** Format: Jan 15, 2025 */
export function formatDate(date) {
  const d = parseDate(date)
  return d ? format(d, 'MMM d, yyyy') : '—'
}

/** Format: 09:30 AM */
export function formatTime(date) {
  const d = parseDate(date)
  return d ? format(d, 'hh:mm aa') : '—'
}

/** Format: Jan 15, 2025 09:30 AM */
export function formatDateTime(date) {
  const d = parseDate(date)
  return d ? format(d, 'MMM d, yyyy hh:mm aa') : '—'
}

/** Format: 87.5% */
export function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${Number(value).toFixed(1)}%`
}

/** Format confidence score: 0.95 → "95%" or "High" */
export function formatConfidence(value) {
  if (value === null || value === undefined) return '—'
  const pct = Math.round(Number(value) * 100)
  return `${pct}%`
}

/** Returns Tailwind text color class based on attendance status */
export function getStatusColor(status) {
  const map = {
    present:  'text-emerald-600',
    late:     'text-amber-600',
    absent:   'text-rose-600',
    online:   'text-emerald-600',
    offline:  'text-rose-600',
    active:   'text-emerald-600',
    inactive: 'text-slate-400',
    unknown:  'text-slate-500',
  }
  return map[(status || '').toLowerCase()] || 'text-slate-500'
}

/**
 * Returns badge variant name for attendance status
 * Used by Badge component
 */
export function getAttendanceStatusBadge(status) {
  const map = {
    present:  'success',
    late:     'warning',
    absent:   'danger',
    online:   'success',
    offline:  'danger',
    active:   'success',
    inactive: 'neutral',
    unknown:  'neutral',
    enrolled: 'success',
    pending:  'warning',
  }
  return map[(status || '').toLowerCase()] || 'neutral'
}

/** Capitalize first letter */
export function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/** Format duration in seconds to "1h 23m" */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Relative time: "2 minutes ago" */
export function timeAgo(date) {
  const d = parseDate(date)
  if (!d) return '—'
  const diff = Math.floor((Date.now() - d.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return formatDate(d)
}
