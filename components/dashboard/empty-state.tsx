import * as React from 'react'
import { AlertCircle, Info, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Empty and error states.
 *
 * The contract: say what is empty, why it matters, and the single next action.
 * No illustration, no "Oops!", no exclamation marks.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  align = 'start',
}: {
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
  align?: 'start' | 'center'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-3 rounded-[8px] border border-dashed border-[var(--dash-line-strong)] bg-[var(--dash-surface-sunken)] px-5 py-6',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-9 items-center justify-center rounded-full border border-[var(--dash-line)] bg-[var(--dash-surface)] text-[var(--dash-ink-4)]">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      ) : null}
      <div className={cn('min-w-0', align === 'center' && 'max-w-[46ch]')}>
        <p className="text-[14px] font-semibold leading-5 text-[var(--dash-ink-1)]">{title}</p>
        {description ? (
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className={cn('flex flex-wrap items-center gap-2', align === 'center' && 'justify-center')}>
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}

/** Error state. Always gives the reader a way to retry, never a stack trace. */
export function ErrorState({
  title = 'That did not load',
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string
  description?: React.ReactNode
  onRetry?: () => void
  retryLabel?: string
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-[8px] border border-[var(--dash-danger)]/25 bg-[var(--dash-danger-bg)] px-4 py-3.5',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--dash-danger)]" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--dash-danger)]">{title}</p>
          {description ? (
            <p className="mt-0.5 text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">{description}</p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="dash-tap inline-flex min-h-[32px] w-fit items-center gap-1.5 rounded-[6px] border border-[var(--dash-danger)]/30 bg-[var(--dash-surface)] px-2.5 text-[12px] font-medium text-[var(--dash-danger)] hover:bg-white"
        >
          <RotateCw className="size-3" aria-hidden="true" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

/** Neutral notice used for non-blocking information (verification banner, ownership notes). */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'warning' | 'brand'
  title?: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 rounded-[8px] border px-4 py-3',
        tone === 'info' && 'border-[var(--dash-info)]/20 bg-[var(--dash-info-bg)]',
        tone === 'warning' && 'border-[var(--dash-warning)]/25 bg-[var(--dash-warning-bg)]',
        tone === 'brand' && 'border-[var(--dash-sand-deep)] bg-[var(--dash-sand)]',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Info
          className={cn(
            'mt-0.5 size-4 shrink-0',
            tone === 'warning' ? 'text-[var(--dash-warning)]' : 'text-[var(--dash-brown)]',
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">
          {title ? <p className="font-semibold text-[var(--dash-ink-1)]">{title}</p> : null}
          {children}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* ------------------------------ skeletons ------------------------------ */

/** Shimmer-free skeleton. A soft pulse only; disabled under prefers-reduced-motion. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('block animate-pulse rounded-[4px] bg-[var(--dash-surface-inset)]', className)}
    />
  )
}

export function PageSkeleton({ tiles = 4, rows = 5 }: { tiles?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      {tiles > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: tiles }).map((_, index) => (
            <div key={index} className="rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-4">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-3 h-6 w-24" />
              <Skeleton className="mt-3 h-2.5 w-28" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)]">
        <div className="border-b border-[var(--dash-line)] px-4 py-3">
          <Skeleton className="h-3.5 w-32" />
        </div>
        <div className="divide-y divide-[var(--dash-line)]">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="ml-auto h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="min-w-0" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading rows</span>
      <div className="hidden md:block">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 border-b border-[var(--dash-line)] px-1 py-3 last:border-0"
          >
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <Skeleton
                key={columnIndex}
                className={cn('h-3', columnIndex === 0 ? 'w-[22%]' : 'flex-1 max-w-[140px]')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, index) => (
          <div key={index} className="rounded-[8px] border border-[var(--dash-line)] p-3">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}
