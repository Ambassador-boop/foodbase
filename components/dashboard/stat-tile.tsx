import * as React from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toneDot, toneText, type Tone } from '@/components/dashboard/tokens'

/**
 * StatTile: one number, its label, and at most one supporting line.
 *
 * Rules that keep this from looking templated:
 *  - the figure is the only large text; the label stays at 12px
 *  - numbers always use tabular figures so a row of tiles aligns
 *  - no icon bubble, no gradient, no coloured corner glow
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  delta,
  tone = 'neutral',
  href,
  className,
  emphasis = false,
  footer,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  hint?: React.ReactNode
  delta?: { value: number; label?: string; goodDirection?: 'up' | 'down' }
  tone?: Tone
  href?: string
  className?: string
  emphasis?: boolean
  footer?: React.ReactNode
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">{label}</p>
        {delta ? <DeltaBadge {...delta} /> : null}
      </div>
      <p
        className={cn(
          'dash-num mt-1.5 flex items-baseline gap-1 leading-none text-[var(--dash-ink-1)]',
          emphasis ? 'text-[26px] sm:text-[30px]' : 'text-[22px] sm:text-[24px]',
        )}
      >
        <span className="font-semibold tracking-[-0.02em]">{value}</span>
        {unit ? <span className="text-[12px] font-medium text-[var(--dash-ink-4)]">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--dash-ink-3)]">{hint}</p> : null}
      {footer ? <div className="mt-3 border-t border-[var(--dash-line)] pt-2.5">{footer}</div> : null}
    </>
  )

  const shell = cn(
    'flex min-w-0 flex-col rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-4',
    href && 'dash-tap hover:border-[var(--dash-line-strong)] hover:bg-[var(--dash-surface-sunken)]',
    tone !== 'neutral' && tone !== 'brand' && 'border-l-[3px]',
    tone === 'success' && 'border-l-[var(--dash-success)]',
    tone === 'warning' && 'border-l-[var(--dash-warning)]',
    tone === 'danger' && 'border-l-[var(--dash-danger)]',
    tone === 'info' && 'border-l-[var(--dash-info)]',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={shell}>
        {body}
      </Link>
    )
  }
  return <div className={shell}>{body}</div>
}

function DeltaBadge({
  value,
  label,
  goodDirection = 'up',
}: {
  value: number
  label?: string
  goodDirection?: 'up' | 'down'
}) {
  const flat = value === 0 || !Number.isFinite(value)
  const positive = value > 0
  const isGood = flat ? null : positive === (goodDirection === 'up')
  const tone: Tone = flat ? 'neutral' : isGood ? 'success' : 'danger'
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('dash-num inline-flex items-center gap-0.5 text-[11.5px] font-medium', toneText[tone])}>
      <Icon className="size-3" aria-hidden="true" />
      {Math.abs(value).toFixed(value % 1 === 0 ? 0 : 1)}%
      {label ? <span className="ml-0.5 font-normal text-[var(--dash-ink-4)]">{label}</span> : null}
    </span>
  )
}

/**
 * StatBar: the compact single-line variant for dense rows (e.g. a summary strip
 * above a table). Same numerals, one third the height.
 */
export function StatBar({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode; tone?: Tone }>
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid min-w-0 grid-cols-2 divide-[var(--dash-line)] rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)] sm:grid-cols-4 sm:divide-x',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            'min-w-0 px-4 py-3',
            index < 2 && 'border-b border-[var(--dash-line)] sm:border-b-0',
          )}
        >
          <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">
            {item.tone ? <span className={cn('size-1.5 rounded-full', toneDot[item.tone])} aria-hidden="true" /> : null}
            {item.label}
          </dt>
          <dd className="dash-num mt-1 text-[15px] font-semibold text-[var(--dash-ink-1)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
