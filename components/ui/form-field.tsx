'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/**
 * FormField: label, control, hint and error as one unit.
 *
 * The error is wired to the control with `aria-describedby` and `aria-invalid`,
 * and it is announced in a live region, so a screen reader hears the problem
 * when it appears. The hint stays visible while an error is showing: replacing
 * "Use at least 8 characters" with "Too short" loses the instruction.
 *
 * The control is passed as a child and is cloned to receive the ids, so no
 * caller has to wire ARIA by hand. An explicit `id` on the child always wins.
 */
export type FormFieldProps = {
  label: string
  htmlFor?: string
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  /** Rendered to the right of the label, for "Optional" or a counter. */
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  aside,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId()
  const controlId = htmlFor ?? `field-${generatedId}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const control = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        {
          id: (children.props as { id?: string }).id ?? controlId,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : undefined,
          'aria-required': required || undefined,
        },
      )
    : children

  return (
    <div data-slot="form-field" className={cn('flex w-full flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={controlId}>
          {label}
          {required ? (
            <span aria-hidden className="text-danger">
              *
            </span>
          ) : null}
        </Label>
        {aside ? <span className="type-caption text-ink-muted">{aside}</span> : null}
      </div>

      {control}

      {hint ? (
        <p id={hintId} className="type-caption text-ink-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="type-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
