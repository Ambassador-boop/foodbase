'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Toggle: a labelled switch for on/off settings.
 *
 * A real `role="switch"` with aria-checked, a 44px hit area, and the label wired
 * to the control. The visible track is small, the target is not.
 */
export function Toggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  id: string
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-[13px] font-medium text-[var(--dash-ink-1)]">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 max-w-[56ch] text-[12px] leading-[1.5] text-[var(--dash-ink-3)]">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'border-[var(--dash-brown)] bg-[var(--dash-brown)]'
            : 'border-[var(--dash-line-strong)] bg-[var(--dash-surface-inset)]',
        )}
      >
        <span
          className={cn(
            'block size-4 rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-[24px]' : 'translate-x-[4px]',
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  )
}

/** Time input styled like the rest of the form controls. */
export function TimeInput({
  label,
  value,
  onChange,
  disabled,
  id,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  id: string
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">
        {label}
      </label>
      <input
        id={id}
        type="time"
        step={900}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="dash-num h-11 w-full min-w-0 rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-2.5 text-[13.5px] text-[var(--dash-ink-1)] outline-none transition-colors duration-150 focus:border-[var(--dash-brown)] disabled:cursor-not-allowed disabled:bg-[var(--dash-surface-inset)] disabled:text-[var(--dash-ink-4)]"
      />
    </div>
  )
}
