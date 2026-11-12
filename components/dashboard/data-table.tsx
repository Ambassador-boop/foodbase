'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * DataTable
 *
 * - sticky header inside its own scroll region (the page itself never scrolls
 *   sideways)
 * - every sortable column is a real <button> with aria-sort on the <th>
 * - below `md` it renders cards instead of a table, so 360px never overflows
 * - numeric columns are right aligned and use tabular figures
 */

export type Column<T> = {
  key: string
  header: React.ReactNode
  render: (row: T) => React.ReactNode
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number | null | undefined
  align?: 'left' | 'right'
  /** Right-aligned figures should set this so digits line up. */
  numeric?: boolean
  className?: string
  headerClassName?: string
  /** Hide this column below a breakpoint. The mobile card still shows it. */
  hideBelow?: 'sm' | 'md' | 'lg'
  width?: string
}

export type SortState = { key: string; direction: 'asc' | 'desc' } | null

function compare(left: unknown, right: unknown): number {
  if (left === null || left === undefined) return 1
  if (right === null || right === undefined) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  getRowHref,
  renderMobile,
  empty,
  caption,
  initialSort,
  sort: controlledSort,
  onSortChange,
  pageSize = 25,
  sticky = true,
  dense = false,
  loading = false,
  footer,
  className,
}: {
  rows: T[]
  columns: Array<Column<T>>
  getRowKey: (row: T) => string
  getRowHref?: (row: T) => string
  /** Custom mobile card. Defaults to "first column + the rest as label/value". */
  renderMobile?: (row: T) => React.ReactNode
  empty: React.ReactNode
  /** Screen-reader description of the table. Required: a table without a name is not accessible. */
  caption: string
  initialSort?: SortState
  sort?: SortState
  onSortChange?: (next: SortState) => void
  pageSize?: number
  sticky?: boolean
  dense?: boolean
  loading?: boolean
  footer?: React.ReactNode
  className?: string
}) {
  const [internalSort, setInternalSort] = React.useState<SortState>(initialSort ?? null)
  const sort = controlledSort !== undefined ? controlledSort : internalSort
  const [visible, setVisible] = React.useState(pageSize)

  React.useEffect(() => {
    setVisible(pageSize)
  }, [rows, pageSize])

  const applySort = (column: Column<T>) => {
    if (!column.sortValue) return
    const next: SortState =
      sort?.key === column.key
        ? { key: column.key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: 'asc' }
    if (controlledSort === undefined) setInternalSort(next)
    onSortChange?.(next)
  }

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const column = columns.find((entry) => entry.key === sort.key)
    if (!column?.sortValue) return rows
    const read = column.sortValue
    return [...rows].sort((a, b) => {
      const result = compare(read(a), read(b))
      return sort.direction === 'asc' ? result : -result
    })
  }, [rows, sort, columns])

  const shown = sorted.slice(0, visible)
  const remaining = sorted.length - shown.length

  if (!loading && rows.length === 0) {
    return <>{empty}</>
  }

  const defaultMobile = (row: T) => {
    const [first, ...rest] = columns
    return (
      <div className="rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface)] px-3 py-2.5">
        <div className="text-[13px] font-medium text-[var(--dash-ink-1)]">{first?.render(row)}</div>
        {rest.length ? (
          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            {rest
              .filter((column) => column.key !== 'actions')
              .map((column) => (
                <div key={column.key} className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">
                    {column.header}
                  </dt>
                  <dd className={cn('truncate text-[12px] text-[var(--dash-ink-1)]', column.numeric && 'dash-num')}>
                    {column.render(row)}
                  </dd>
                </div>
              ))}
          </dl>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('min-w-0', className)} aria-busy={loading || undefined}>
      {/* Mobile: cards. No horizontal scrolling at 360px. */}
      <div className="flex flex-col gap-2 md:hidden">
        {shown.map((row) => {
          const href = getRowHref?.(row)
          const card = (renderMobile ?? defaultMobile)(row)
          return href ? (
            <Link key={getRowKey(row)} href={href} className="dash-tap block rounded-[8px] hover:brightness-[0.99]">
              {card}
            </Link>
          ) : (
            <div key={getRowKey(row)}>{card}</div>
          )
        })}
      </div>

      {/* Desktop: table with a sticky header. */}
      <div className="hidden min-w-0 md:block">
        <div className={cn('min-w-0', sticky && 'max-h-[min(70vh,760px)] overflow-auto')}>
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead
              className={cn(
                'bg-[var(--dash-surface-sunken)]',
                sticky && 'sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--dash-line)]',
              )}
            >
              <tr>
                {columns.map((column) => {
                  const active = sort?.key === column.key
                  const ariaSort = active
                    ? sort?.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : column.sortValue
                      ? 'none'
                      : undefined
                  const Icon = active ? (sort?.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={ariaSort}
                      style={column.width ? { width: column.width } : undefined}
                      className={cn(
                        'px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--dash-ink-4)] first:pl-4 last:pr-4',
                        column.align === 'right' && 'text-right',
                        column.hideBelow === 'sm' && 'hidden sm:table-cell',
                        column.hideBelow === 'md' && 'hidden md:table-cell',
                        column.hideBelow === 'lg' && 'hidden lg:table-cell',
                        column.headerClassName,
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => applySort(column)}
                          className={cn(
                            'dash-tap inline-flex items-center gap-1 rounded-[4px] hover:text-[var(--dash-ink-1)]',
                            column.align === 'right' && 'flex-row-reverse',
                            active && 'text-[var(--dash-ink-1)]',
                          )}
                        >
                          {column.header}
                          <Icon
                            className={cn('size-3 shrink-0', active ? 'opacity-100' : 'opacity-50')}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const href = getRowHref?.(row)
                return (
                  <tr
                    key={getRowKey(row)}
                    className="border-b border-[var(--dash-line)] last:border-0 even:bg-[var(--dash-surface-sunken)]/40 hover:bg-[var(--dash-sand)]/45"
                  >
                    {columns.map((column, index) => {
                      const content = column.render(row)
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'px-3 align-middle text-[12.5px] text-[var(--dash-ink-2)] first:pl-4 last:pr-4',
                            dense ? 'py-2' : 'py-2.5',
                            column.align === 'right' && 'text-right',
                            column.numeric && 'dash-num',
                            column.hideBelow === 'sm' && 'hidden sm:table-cell',
                            column.hideBelow === 'md' && 'hidden md:table-cell',
                            column.hideBelow === 'lg' && 'hidden lg:table-cell',
                            column.className,
                          )}
                        >
                          {href && index === 0 ? (
                            <Link
                              href={href}
                              className="rounded-[3px] font-medium text-[var(--dash-ink-1)] underline-offset-4 hover:text-[var(--dash-brown)] hover:underline"
                            >
                              {content}
                            </Link>
                          ) : (
                            content
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {remaining > 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 px-1">
          <p className="dash-num text-[11.5px] text-[var(--dash-ink-3)]">
            Showing {shown.length} of {sorted.length}
          </p>
          <button
            type="button"
            onClick={() => setVisible((value) => value + pageSize)}
            className="dash-tap inline-flex min-h-[36px] items-center rounded-[6px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-3 text-[12px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
          >
            Show {Math.min(pageSize, remaining)} more
          </button>
        </div>
      ) : null}

      {footer ? <div className="mt-3 border-t border-[var(--dash-line)] pt-3">{footer}</div> : null}
    </div>
  )
}

/* ------------------------------ controls ------------------------------ */

/** Search input for a table toolbar. Debounce in the caller, not here. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (next: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-0 sm:max-w-[320px]', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--dash-ink-4)]"
      >
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] pl-9 pr-3 text-[13px] text-[var(--dash-ink-1)] outline-none transition-colors duration-150 placeholder:text-[var(--dash-ink-4)] focus:border-[var(--dash-brown)]"
      />
    </div>
  )
}

/**
 * FilterTabs: a small segmented control. Rendered as pressed buttons rather than
 * ARIA tabs, because these are filters on one list, not separate panels.
 */
export function FilterTabs({
  value,
  onChange,
  options,
  label = 'Filter',
}: {
  value: string
  onChange: (next: string) => void
  options: Array<{ value: string; label: string; count?: number }>
  label?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface-sunken)] p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'dash-tap inline-flex h-8 items-center gap-1 rounded-[6px] px-2.5 text-[12px] font-medium',
              active
                ? 'bg-[var(--dash-surface)] text-[var(--dash-ink-1)] shadow-[var(--dash-shadow-1)]'
                : 'text-[var(--dash-ink-3)] hover:text-[var(--dash-ink-1)]',
            )}
          >
            {option.label}
            {typeof option.count === 'number' ? (
              <span className="dash-num text-[11px] text-[var(--dash-ink-4)]">{option.count}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
