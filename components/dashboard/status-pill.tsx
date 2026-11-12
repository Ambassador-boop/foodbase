import * as React from 'react'
import { cn } from '@/lib/utils'
import { statusTone, toneDot, toneSurface, type Tone } from '@/components/dashboard/tokens'

/**
 * StatusPill: the only way status is rendered in the dashboard.
 *
 * A dot plus a word, at 11.5px. Colour never carries meaning alone: the label
 * always says what the state is, so the pill survives greyscale and screen readers.
 */
export function StatusPill({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: Tone
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11.5px] font-medium leading-4',
        toneSurface[tone],
        className,
      )}
    >
      {dot ? <span className={cn('size-1.5 shrink-0 rounded-full', toneDot[tone])} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/** Convenience wrapper for raw domain values (order status, payout status, …). */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string | null | undefined
  label?: string
  className?: string
}) {
  const mapped = statusTone(status)
  return (
    <StatusPill tone={mapped.tone} className={className}>
      {label ?? mapped.label}
    </StatusPill>
  )
}

/**
 * Counter: a neutral numeral for "3 items" style counts. Tabular, no pill chrome.
 */
export function Counter({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1 text-[12px] text-[var(--dash-ink-3)]', className)}>
      <span className="dash-num font-semibold text-[var(--dash-ink-1)]">{value}</span>
      {label ? <span>{label}</span> : null}
    </span>
  )
}
