'use client'

import Link from 'next/link'
import * as React from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Inbox, Minus, RefreshCw, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { money } from '@/components/admin/format'

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand'

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--neutral-bg)] text-[var(--neutral)]',
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger)]',
  brand: 'bg-accent text-accent-foreground',
}

const toneDot: Record<Tone, string> = {
  neutral: 'bg-[var(--neutral)]',
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  danger: 'bg-[var(--danger)]',
  brand: 'bg-primary',
}

export function StatusPill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', toneClasses[tone])}>
      <span className={cn('size-1.5 rounded-full', toneDot[tone])} aria-hidden="true" />
      {children}
    </span>
  )
}

/** Payment / order / withdrawal status mapping used everywhere in admin. */
export function statusTone(status: string | null | undefined): { tone: Tone; label: string } {
  const value = String(status ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  if (value === 'paid') return { tone: 'success', label: 'Paid' }
  if (['success', 'completed', 'processed', 'settled', 'confirmed', 'resolved', 'active'].includes(value)) {
    return { tone: 'success', label: value.charAt(0).toUpperCase() + value.slice(1) }
  }
  if (['pending', 'processing', 'queued', 'otp', 'received', 'approved', 'unsettled', 'in_progress'].includes(value)) {
    return { tone: 'warning', label: value.charAt(0).toUpperCase() + value.slice(1) }
  }
  if (['failed', 'rejected', 'abandoned', 'blocked', 'reversed', 'deficit', 'unresolved', 'error'].includes(value)) {
    return { tone: 'danger', label: value.charAt(0).toUpperCase() + value.slice(1) }
  }
  if (['unreconciled', 'stale', 'unknown'].includes(value)) return { tone: 'warning', label: value.charAt(0).toUpperCase() + value.slice(1) }
  return { tone: 'neutral', label: value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ') : 'Unknown' }
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const { tone, label } = statusTone(status)
  return <StatusPill tone={tone}>{label}</StatusPill>
}

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.01em] text-foreground">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({
  title,
  description,
  action,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border border-border bg-card', className)}>
      {title || action ? (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title ? <h2 className="text-[14px] font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn('min-w-0 flex-1 px-4 py-4 sm:px-5', bodyClassName)}>{children}</div>
      {footer ? <footer className="border-t border-border px-4 py-3 sm:px-5">{footer}</footer> : null}
    </section>
  )
}

export function Delta({
  changePct,
  noBaseline,
  goodWhenUp = true,
  label,
}: {
  changePct: number | null
  noBaseline?: boolean
  goodWhenUp?: boolean
  label?: string
}) {
  if (changePct === null || changePct === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
        {noBaseline ? 'No prior period' : 'Not comparable'}
      </span>
    )
  }
  const rounded = Math.abs(changePct) < 0.05 ? 0 : changePct
  const positive = rounded > 0
  const neutral = rounded === 0
  const good = neutral ? null : positive === goodWhenUp
  const Icon = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[12px] font-medium',
        good === null ? 'text-muted-foreground' : good ? 'text-[var(--success)]' : 'text-[var(--danger)]',
      )}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="num">
        {neutral ? '0%' : `${positive ? '+' : '−'}${Math.abs(rounded).toFixed(1)}%`}
      </span>
      {label ? <span className="font-normal text-muted-foreground">{label}</span> : null}
    </span>
  )
}

export function StatTile({
  label,
  value,
  hint,
  delta,
  footer,
  emphasis = false,
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  delta?: React.ReactNode
  footer?: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3.5',
        emphasis && 'border-primary/25 bg-accent/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        {delta ? <div className="shrink-0 text-right">{delta}</div> : null}
      </div>
      <p className={cn('num truncate text-[22px] leading-7 font-semibold tracking-[-0.02em]', emphasis ? 'text-primary' : 'text-foreground')}>
        {value}
      </p>
      {hint ? <p className="text-[12px] leading-4 text-muted-foreground">{hint}</p> : null}
      {footer}
    </div>
  )
}

export function Money({ value, className, signed = false }: { value: number | null | undefined; className?: string; signed?: boolean }) {
  const amount = value === null || value === undefined ? null : Number(value)
  const negative = amount !== null && amount < 0
  return (
    <span className={cn('num whitespace-nowrap', negative && 'text-[var(--danger)]', className)}>
      {negative && signed ? '−' : ''}
      {amount === null ? '—' : money(Math.abs(amount))}
    </span>
  )
}

export function KeyValue({
  label,
  value,
  hint,
  tone,
  border = true,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'danger' | 'success'
  border?: boolean
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', border && 'border-b border-border last:border-0')}>
      <div className="min-w-0">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground/80">{hint}</p> : null}
      </div>
      <div
        className={cn(
          'num shrink-0 text-right text-[13px] font-medium',
          tone === 'danger' && 'text-[var(--danger)]',
          tone === 'success' && 'text-[var(--success)]',
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function ProgressBar({ value, tone = 'brand', label }: { value: number; tone?: 'brand' | 'danger' | 'success' | 'warning'; label?: string }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  const fill =
    tone === 'danger' ? 'bg-[var(--danger)]' : tone === 'success' ? 'bg-[var(--success)]' : tone === 'warning' ? 'bg-[var(--warning)]' : 'bg-primary'
  return (
    <div className="w-full">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={label ?? `${clamped.toFixed(0)} percent`}>
        <div className={cn('h-full rounded-full', fill)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="text-[13px] font-medium text-[var(--danger)]">Could not load this data</p>
          <p className="mt-0.5 text-[12px] text-[var(--danger)]/80">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 border-[var(--danger)]/30">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Retry
        </Button>
      ) : null}
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className={cn('h-4', columnIndex === 0 ? 'w-4/5' : 'w-1/2 justify-self-end')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PanelSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-3.5 w-full" />
      ))}
    </div>
  )
}

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: T) => React.ReactNode
  sortValue?: (row: T) => number | string | null
  className?: string
  headerClassName?: string
}

/**
 * Dense, keyboard-friendly data table with a sticky header and client-side sorting.
 * On small screens the table is replaced by stacked cards via `renderMobile`.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  getRowHref,
  renderMobile,
  empty,
  initialSortKey,
  initialSortDirection = 'desc',
  pageSize = 25,
  caption,
}: {
  rows: T[]
  columns: Column<T>[]
  getRowKey: (row: T) => string
  getRowHref?: (row: T) => string
  renderMobile?: (row: T) => React.ReactNode
  empty: React.ReactNode
  initialSortKey?: string
  initialSortDirection?: 'asc' | 'desc'
  pageSize?: number
  caption: string
}) {
  const [sortKey, setSortKey] = React.useState<string | null>(initialSortKey ?? null)
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(initialSortDirection)
  const [visible, setVisible] = React.useState(pageSize)

  React.useEffect(() => {
    setVisible(pageSize)
  }, [rows, pageSize])

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows
    const column = columns.find((entry) => entry.key === sortKey)
    if (!column?.sortValue) return rows
    const value = column.sortValue
    return [...rows].sort((a, b) => {
      const left = value(a)
      const right = value(b)
      if (left === null || left === undefined) return 1
      if (right === null || right === undefined) return -1
      if (typeof left === 'number' && typeof right === 'number') {
        return sortDirection === 'asc' ? left - right : right - left
      }
      return sortDirection === 'asc'
        ? String(left).localeCompare(String(right))
        : String(right).localeCompare(String(left))
    })
  }, [rows, sortKey, sortDirection, columns])

  const shown = sorted.slice(0, visible)

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return
    if (sortKey === column.key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(column.key)
    setSortDirection('desc')
  }

  if (rows.length === 0) return <>{empty}</>

  return (
    <div className="min-w-0">
      {renderMobile ? <div className="space-y-2 md:hidden">{shown.map((row) => <div key={getRowKey(row)}>{renderMobile(row)}</div>)}</div> : null}

      <div className="hidden min-w-0 md:block">
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border">
                {columns.map((column) => {
                  const active = sortKey === column.key
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : column.sortValue ? 'none' : undefined}
                      className={cn(
                        'px-3 py-2 text-[11px] font-medium tracking-[0.02em] whitespace-nowrap text-muted-foreground uppercase first:pl-0 last:pr-0',
                        column.align === 'right' && 'text-right',
                        column.headerClassName,
                      )}
                    >
                      {column.sortValue ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            column.align === 'right' && 'flex-row-reverse',
                            active && 'text-foreground',
                          )}
                        >
                          {column.header}
                          <span aria-hidden="true" className={cn('text-[9px] leading-none', active ? 'opacity-100' : 'opacity-0')}>
                            {sortDirection === 'asc' ? '▲' : '▼'}
                          </span>
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
                  <tr key={getRowKey(row)} className="border-b border-border/70 last:border-0 hover:bg-muted/40">
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          'px-3 py-2.5 align-middle text-[13px] first:pl-0 last:pr-0',
                          column.align === 'right' && 'text-right',
                          column.className,
                        )}
                      >
                        {href && index === 0 ? (
                          <Link
                            href={href}
                            className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {column.render(row)}
                          </Link>
                        ) : (
                          column.render(row)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {visible < sorted.length ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-muted-foreground">
            Showing {shown.length} of {sorted.length}
          </p>
          <Button variant="outline" size="sm" onClick={() => setVisible((current) => current + pageSize)}>
            Show {Math.min(pageSize, sorted.length - visible)} more
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 pl-8 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  unit,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onChange: (page: number) => void
  unit: string
}) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-[12px] text-muted-foreground">
        {first}–{last} of {total} {unit}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={`Previous page of ${unit}`}>
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </Button>
        <span className="num text-[12px] text-muted-foreground">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={`Next page of ${unit}`}
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function MobileRow({
  title,
  value,
  status,
  meta,
  href,
  children,
}: {
  title: React.ReactNode
  value: React.ReactNode
  status?: React.ReactNode
  meta?: React.ReactNode
  href?: string
  children?: React.ReactNode
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground">{title}</p>
          {meta ? <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{meta}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="num text-[13px] font-semibold text-foreground">{value}</p>
          {status ? <div className="mt-1 flex justify-end">{status}</div> : null}
        </div>
      </div>
      {children}
    </>
  )
  if (href) {
    return (
      <Link href={href} className="block rounded-lg border border-border bg-card px-3 py-3 hover:bg-muted/40">
        {content}
      </Link>
    )
  }
  return <div className="rounded-lg border border-border bg-card px-3 py-3">{content}</div>
}

export { Badge, Button, Input }
