import * as React from 'react'
import Link from 'next/link'
import { Check, Circle, Lock, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * ChecklistItem
 *
 * One onboarding step. It answers four questions in a fixed order so the list
 * scans vertically: what it is, why it matters, how long it takes, and whether
 * it is done. `status` is derived from real data by the caller, never stored.
 */
export type ChecklistStatus = 'done' | 'todo' | 'skipped' | 'locked'

export function ChecklistItem({
  title,
  why,
  minutes,
  status,
  href,
  actionLabel,
  onSkip,
  skipLabel = 'Skip for now',
  lockedReason,
  index,
  className,
}: {
  title: string
  why: React.ReactNode
  /** Estimated hands-on time. Rendered as "about 2 min". */
  minutes?: number
  status: ChecklistStatus
  href?: string
  actionLabel?: string
  onSkip?: () => void
  skipLabel?: string
  lockedReason?: string
  index?: number
  className?: string
}) {
  const done = status === 'done'
  const locked = status === 'locked'
  const skipped = status === 'skipped'

  const marker = locked ? (
    <Lock className="size-3.5" aria-hidden="true" />
  ) : done ? (
    <Check className="size-3.5" aria-hidden="true" />
  ) : skipped ? (
    <SkipForward className="size-3.5" aria-hidden="true" />
  ) : (
    <Circle className="size-3" aria-hidden="true" />
  )

  return (
    <li
      className={cn(
        'group relative flex min-w-0 gap-3 border-b border-[var(--dash-line)] px-4 py-3.5 last:border-0 sm:px-5',
        done && 'bg-[var(--dash-surface-sunken)]/60',
        className,
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
          done && 'border-[var(--dash-success)] bg-[var(--dash-success-bg)] text-[var(--dash-success)]',
          skipped && 'border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[var(--dash-ink-4)]',
          locked && 'border-[var(--dash-line)] bg-[var(--dash-surface-inset)] text-[var(--dash-ink-4)]',
          status === 'todo' && 'border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[var(--dash-brown)]',
        )}
        aria-hidden="true"
      >
        {marker}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {typeof index === 'number' ? (
            <span className="dash-num text-[11px] font-semibold text-[var(--dash-ink-4)]">
              {String(index).padStart(2, '0')}
            </span>
          ) : null}
          <h3
            className={cn(
              'text-[13.5px] font-semibold leading-5',
              done ? 'text-[var(--dash-ink-3)]' : 'text-[var(--dash-ink-1)]',
            )}
          >
            {title}
          </h3>
          {typeof minutes === 'number' ? (
            <span className="dash-num text-[11px] text-[var(--dash-ink-4)]">
              {minutes <= 1 ? 'about 1 min' : `about ${minutes} min`}
            </span>
          ) : null}
          {done ? <span className="sr-only">Completed</span> : null}
          {skipped ? (
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">Skipped</span>
          ) : null}
          {locked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--dash-info-bg)] px-2 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--dash-info)]">
              Coming next
            </span>
          ) : null}
        </div>

        <p
          className={cn(
            'mt-1 max-w-[68ch] text-[12.5px] leading-[1.55]',
            done ? 'text-[var(--dash-ink-4)]' : 'text-[var(--dash-ink-3)]',
          )}
        >
          {why}
        </p>
        {locked && lockedReason ? (
          <p className="mt-1 text-[11.5px] leading-[1.45] text-[var(--dash-ink-4)]">{lockedReason}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {!done && !locked && href ? (
            <Link
              href={href}
              className="dash-tap inline-flex min-h-[32px] items-center rounded-[6px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-2.5 text-[12px] font-medium text-[var(--dash-ink-1)] hover:border-[var(--dash-brown)] hover:text-[var(--dash-brown)]"
            >
              {actionLabel ?? 'Open'}
            </Link>
          ) : null}
          {done && href ? (
            <Link
              href={href}
              className="text-[12px] font-medium text-[var(--dash-ink-3)] underline-offset-4 hover:text-[var(--dash-brown)] hover:underline"
            >
              Review
            </Link>
          ) : null}
          {!done && !locked && onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="dash-tap inline-flex min-h-[32px] items-center text-[12px] font-medium text-[var(--dash-ink-3)] underline-offset-4 hover:text-[var(--dash-ink-1)] hover:underline"
            >
              {skipLabel}
            </button>
          ) : null}
          {skipped && href ? (
            <Link
              href={href}
              className="text-[12px] font-medium text-[var(--dash-brown)] underline-offset-4 hover:underline"
            >
              Set it up
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  )
}
