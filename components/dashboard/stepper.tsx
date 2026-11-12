'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Stepper
 *
 * Shows position in a short sequence (3-5 steps). It is a status indicator, not
 * a wizard: pass onSelect only if jumping between steps is actually allowed.
 * Horizontal from 640px up, vertical below, and it never relies on colour alone.
 */
export function Stepper({
  steps,
  current,
  onSelect,
  className,
  label = 'Progress',
}: {
  steps: Array<{ key: string; label: string; hint?: string }>
  /** Zero-based index of the active step. Steps before it are marked complete. */
  current: number
  onSelect?: (index: number) => void
  className?: string
  label?: string
}) {
  const total = steps.length
  return (
    <nav aria-label={label} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 flex-col gap-0 sm:flex-row sm:items-start">
        {steps.map((step, index) => {
          const complete = index < current
          const active = index === current
          const interactive = Boolean(onSelect)
          const content = (
            <>
              <span
                className={cn(
                  'dash-num flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-150',
                  complete && 'border-[var(--dash-brown)] bg-[var(--dash-brown)] text-white',
                  active && 'border-[var(--dash-brown)] bg-[var(--dash-surface)] text-[var(--dash-brown)]',
                  !complete && !active && 'border-[var(--dash-line-strong)] bg-[var(--dash-surface)] text-[var(--dash-ink-4)]',
                )}
              >
                {complete ? <Check className="size-3" aria-hidden="true" /> : index + 1}
              </span>
              <span className="min-w-0 sm:mt-2 sm:text-center">
                <span
                  className={cn(
                    'block text-[12.5px] leading-4',
                    active ? 'font-semibold text-[var(--dash-ink-1)]' : 'font-medium text-[var(--dash-ink-3)]',
                  )}
                >
                  {step.label}
                </span>
                {step.hint ? (
                  <span className="mt-0.5 block text-[11px] leading-[1.4] text-[var(--dash-ink-4)]">{step.hint}</span>
                ) : null}
              </span>
            </>
          )

          return (
            <li key={step.key} className="relative min-w-0 flex-1">
              {/* connector */}
              {index < total - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-[11px] top-[26px] h-[calc(100%-18px)] w-px sm:left-[calc(50%+18px)] sm:top-3 sm:h-px sm:w-[calc(100%-36px)]',
                    complete ? 'bg-[var(--dash-brown)]' : 'bg-[var(--dash-line-strong)]',
                  )}
                />
              ) : null}
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onSelect?.(index)}
                  aria-current={active ? 'step' : undefined}
                  className="dash-tap relative flex w-full min-h-[44px] items-start gap-2.5 rounded-[6px] py-1.5 pr-2 text-left hover:bg-[var(--dash-surface-sunken)] sm:flex-col sm:items-center sm:gap-0 sm:px-1"
                >
                  {content}
                </button>
              ) : (
                <div
                  aria-current={active ? 'step' : undefined}
                  className="relative flex min-h-[44px] items-start gap-2.5 py-1.5 pr-2 sm:flex-col sm:items-center sm:gap-0 sm:px-1"
                >
                  {content}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Step {Math.min(current + 1, total)} of {total}: {steps[current]?.label ?? ''}
      </p>
    </nav>
  )
}

/** Thin determinate progress line, used where a full stepper would be noise. */
export function ProgressLine({
  value,
  label,
  className,
  tone = 'brand',
}: {
  value: number
  label?: string
  className?: string
  tone?: 'brand' | 'success' | 'warning'
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={cn('min-w-0', className)}>
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11.5px] font-medium text-[var(--dash-ink-2)]">{label}</span>
          <span className="dash-num text-[11.5px] font-semibold text-[var(--dash-ink-1)]">{clamped}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-line)]"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200 ease-out',
            tone === 'brand' && 'bg-[var(--dash-brown)]',
            tone === 'success' && 'bg-[var(--dash-success)]',
            tone === 'warning' && 'bg-[var(--dash-warning)]',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
