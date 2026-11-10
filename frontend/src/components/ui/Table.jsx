import React from 'react'
import { cn } from '../../utils/cn'
import Spinner from './Spinner'

function SkeletonRow({ columns }) {
  return (
    <tr>
      {columns.map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}

function EmptyState({ message = 'No data found', icon: Icon }) {
  return (
    <tr>
      <td colSpan={999}>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          {Icon ? (
            <Icon className="w-10 h-10 text-slate-300 mb-3" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <span className="text-slate-400 text-lg">∅</span>
            </div>
          )}
          <p className="text-sm font-medium text-slate-500">{message}</p>
        </div>
      </td>
    </tr>
  )
}

/**
 * Reusable data table.
 * @param {Array}   columns - [{ key, label, render?, align?, className? }]
 * @param {Array}   data    - Row objects
 * @param {boolean} loading - Show skeleton while loading
 * @param {string}  emptyMessage - Shown when data is empty
 * @param {string}  className - Additional wrapper class
 */
export default function Table({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyIcon,
  className = '',
  onRowClick,
  getRowKey,
}) {
  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-slate-100', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.headerClassName
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columns={columns} />
            ))
          ) : data.length === 0 ? (
            <EmptyState message={emptyMessage} icon={emptyIcon} />
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={getRowKey ? getRowKey(row) : (row._id || row.id || rowIdx)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors duration-150',
                  rowIdx % 2 === 1 && 'bg-slate-50/50',
                  onRowClick && 'cursor-pointer hover:bg-primary-50/40',
                  !onRowClick && 'hover:bg-slate-50/80'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-slate-700 whitespace-nowrap',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.className
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key], row, rowIdx)
                      : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Pagination controls */
export function Pagination({ page, totalPages, onPageChange, className = '' }) {
  if (totalPages <= 1) return null
  return (
    <div className={cn('flex items-center justify-between gap-2 mt-4', className)}>
      <span className="text-xs text-slate-500">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-8 h-8 text-xs rounded-lg border transition-colors',
                p === page
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              )}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
