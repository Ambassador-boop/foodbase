import * as React from 'react'
import { ArrowDown, ArrowUp, Minus } from '@phosphor-icons/react/dist/ssr'

import { cn } from '@/lib/utils'

/**
 * Stat. A KPI tile: a label, the number, and an optional change.
 *
 * The change is an arrow, a sign and a word, not a colour: "up" and "down" are
 * not always good and bad, so the tile never decides that for the reader. The
 * number is tabular so a row of tiles lines up.
 */
export type StatProps = {
  label: string
  value: React.ReactNode
  /** e.g. "+12.4%" or "-₦1,200.00". Rendered with an arrow and a sign. */
  change?: string
  /** Which way the change points. Drives the arrow only. */
  direction?: 'up' | 'down' | 'flat'
  /** Context for the change, e.g. "vs last week". */
  changeLabel?: string
  /** A sentence under the value, for what the number means. */
  hint?: string
  className?: string
}

const ARROWS = { up: ArrowUp, down: ArrowDown, flat: Minus } as const

export function Stat({
  label,
  value,
  change,
  direction = 'flat',
  changeLabel,
  hint,
  className,
}: StatProps) {
  const Arrow = ARROWS[direction]
  const directionWord =
    direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'No change'

  return (
    <div
      data-slot="stat"
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-card p-4',
        className,
      )}
    >
      <p className="type-caption font-medium tracking-wide text-ink-muted uppercase">{label}</p>

      <p className="tnum type-h3 text-ink">{value}</p>

      {change || hint ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {change ? (
            <span className="inline-flex items-center gap-1 type-caption text-ink">
              <Arrow className="size-3.5" weight="bold" aria-hidden />
              <span className="sr-only">{directionWord}: </span>
              <span className="tnum">{change}</span>
            </span>
          ) : null}
          {changeLabel || hint ? (
            <span className="type-caption text-ink-muted">{changeLabel ?? hint}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
