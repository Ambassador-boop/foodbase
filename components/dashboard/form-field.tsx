'use client'

import * as React from 'react'
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Form primitives with inline validation.
 *
 * Every control:
 *  - is at least 44px tall on touch (h-11), 40px when explicitly compact
 *  - wires label / hint / error to the input with aria-describedby and aria-invalid
 *  - renders its error as text next to the field, not in a toast
 *  - keeps the message in sentence case and says what to do
 */

let fieldCounter = 0
function useFieldId(provided?: string) {
  const generated = React.useId()
  return provided ?? `f${generated.replace(/[:»]/g, '') || ++fieldCounter}`
}

export type FieldMeta = {
  id: string
  name?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  'aria-required'?: boolean
  disabled?: boolean
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
  counter,
  size = 'default',
}: {
  label: React.ReactNode
  htmlFor: string
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  optionalLabel?: boolean
  className?: string
  children: (meta: FieldMeta) => React.ReactNode
  counter?: React.ReactNode
  size?: 'default' | 'compact'
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-[12px] font-semibold text-[var(--dash-ink-1)]"
        >
          {label}
          {required ? (
            <span className="ml-0.5 text-[var(--dash-brown)]" aria-hidden="true">
              *
            </span>
          ) : optionalLabel ? (
            <span className="ml-1 text-[11px] font-normal text-[var(--dash-ink-4)]">optional</span>
          ) : null}
        </label>
        {counter ? <span className="dash-num text-[11px] text-[var(--dash-ink-4)]">{counter}</span> : null}
      </div>

      {children({
        id: htmlFor,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
        name: htmlFor,
      })}

      {hint && !error ? (
        <p id={hintId} className="mt-1 text-[11.5px] leading-[1.45] text-[var(--dash-ink-3)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="mt-1 flex items-start gap-1 text-[11.5px] leading-[1.45] text-[var(--dash-danger)]"
        >
          <AlertCircle className="mt-[1px] size-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {size === 'compact' ? null : null}
    </div>
  )
}

const controlBase =
  'w-full min-w-0 rounded-[8px] border bg-[var(--dash-surface)] px-3 text-[13.5px] text-[var(--dash-ink-1)] placeholder:text-[var(--dash-ink-4)] transition-[border-color,box-shadow] duration-150 outline-none disabled:cursor-not-allowed disabled:bg-[var(--dash-surface-inset)] disabled:text-[var(--dash-ink-3)]'

const controlTone = (invalid?: boolean) =>
  invalid
    ? 'border-[var(--dash-danger)] focus:border-[var(--dash-danger)] focus-visible:ring-2 focus-visible:ring-[var(--dash-danger)]/25'
    : 'border-[var(--dash-line-strong)] hover:border-[var(--dash-ink-4)] focus:border-[var(--dash-brown)] focus-visible:ring-2 focus-visible:ring-[var(--dash-brown)]/20'

/** Text input. `leading` lets a fixed prefix (a URL, a currency) sit inside the control. */
export function TextInput({
  leading,
  trailing,
  invalid,
  className,
  compact,
  ...props
}: React.ComponentProps<'input'> & {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  invalid?: boolean
  compact?: boolean
}) {
  const field = (
    <input
      {...props}
      aria-invalid={invalid || props['aria-invalid']}
      className={cn(
        controlBase,
        controlTone(invalid),
        compact ? 'h-10' : 'h-11',
        leading ? 'pl-[74px]' : undefined,
        trailing ? 'pr-11' : undefined,
        className,
      )}
    />
  )
  if (!leading && !trailing) return field
  return (
    <div className="relative min-w-0">
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-[var(--dash-line)] pl-3 pr-2 text-[12.5px] font-medium text-[var(--dash-ink-3)]">
          {leading}
        </span>
      ) : null}
      {field}
      {trailing ? <span className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</span> : null}
    </div>
  )
}

export function TextAreaField({
  invalid,
  className,
  rows = 4,
  ...props
}: React.ComponentProps<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      rows={rows}
      {...props}
      aria-invalid={invalid || props['aria-invalid']}
      className={cn(controlBase, controlTone(invalid), 'resize-y py-2.5 leading-[1.55]', className)}
    />
  )
}

export function SelectInput({
  invalid,
  className,
  children,
  compact,
  ...props
}: React.ComponentProps<'select'> & { invalid?: boolean; compact?: boolean }) {
  return (
    <div className="relative min-w-0">
      <select
        {...props}
        aria-invalid={invalid || props['aria-invalid']}
        className={cn(
          controlBase,
          controlTone(invalid),
          compact ? 'h-10' : 'h-11',
          'appearance-none pr-9',
          className,
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 8"
        className="pointer-events-none absolute right-3 top-1/2 size-2.5 -translate-y-1/2 text-[var(--dash-ink-3)]"
      >
        <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** Password input with a visible show/hide control that does not steal the tab order. */
export function PasswordInput({
  invalid,
  className,
  compact,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & { invalid?: boolean; compact?: boolean }) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative min-w-0">
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        aria-invalid={invalid || props['aria-invalid']}
        className={cn(
          controlBase,
          controlTone(invalid),
          compact ? 'h-10' : 'h-11',
          'pr-12',
          className,
        )}
      />
      <button
        type="button"
        onClick={() => setShown((value) => !value)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="dash-tap absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[8px] text-[var(--dash-ink-3)] hover:text-[var(--dash-ink-1)]"
      >
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

/** Checkbox row. The whole label is the target, so a 44px tap area is easy to hit. */
export function CheckboxField({
  id,
  label,
  description,
  error,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & {
  label: React.ReactNode
  description?: React.ReactNode
  error?: string | null
}) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex min-h-[44px] items-start gap-2.5 py-1.5">
        <span className="relative mt-0.5 flex shrink-0 items-center">
          <input
            {...props}
            id={id}
            type="checkbox"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className="peer size-[18px] cursor-pointer appearance-none rounded-[4px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] checked:border-[var(--dash-brown)] checked:bg-[var(--dash-brown)] disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Check
            className="pointer-events-none absolute left-[3px] top-[3px] size-3 text-white opacity-0 peer-checked:opacity-100"
            aria-hidden="true"
          />
        </span>
        <label htmlFor={id} className="min-w-0 cursor-pointer text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">
          {label}
          {description ? (
            <span className="mt-0.5 block text-[11.5px] leading-[1.45] text-[var(--dash-ink-3)]">{description}</span>
          ) : null}
        </label>
      </div>
      {error ? (
        <p id={errorId} className="mt-1 flex items-start gap-1 pl-[28px] text-[11.5px] text-[var(--dash-danger)]">
          <AlertCircle className="mt-[1px] size-3 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* ----------------------------- convenience ----------------------------- */

type CommonProps = {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: string | null
  required?: boolean
  optionalLabel?: boolean
  className?: string
}

export const TextField = React.forwardRef<
  HTMLInputElement,
  CommonProps & Omit<React.ComponentProps<'input'>, 'className'> & { leading?: React.ReactNode }
>(function TextField({ label, hint, error, required, optionalLabel, className, leading, ...props }, ref) {
  const id = useFieldId(props.id)
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
    >
      {(meta) => (
        <TextInput
          {...props}
          ref={ref}
          id={meta.id}
          name={props.name ?? meta.id}
          aria-describedby={meta['aria-describedby']}
          aria-required={meta['aria-required']}
          invalid={Boolean(error)}
          leading={leading}
        />
      )}
    </FormField>
  )
})

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  CommonProps & Omit<React.ComponentProps<'textarea'>, 'className'>
>(function TextArea({ label, hint, error, required, optionalLabel, className, ...props }, ref) {
  const id = useFieldId(props.id)
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
    >
      {(meta) => (
        <TextAreaField
          {...props}
          ref={ref}
          id={meta.id}
          name={props.name ?? meta.id}
          aria-describedby={meta['aria-describedby']}
          aria-required={meta['aria-required']}
          invalid={Boolean(error)}
        />
      )}
    </FormField>
  )
})

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  CommonProps & Omit<React.ComponentProps<'select'>, 'className'>
>(function SelectField({ label, hint, error, required, optionalLabel, className, children, ...props }, ref) {
  const id = useFieldId(props.id)
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
    >
      {(meta) => (
        <SelectInput
          {...props}
          ref={ref}
          id={meta.id}
          name={props.name ?? meta.id}
          aria-describedby={meta['aria-describedby']}
          aria-required={meta['aria-required']}
          invalid={Boolean(error)}
        >
          {children}
        </SelectInput>
      )}
    </FormField>
  )
})

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  CommonProps & Omit<React.ComponentProps<'input'>, 'className' | 'type'>
>(function PasswordField({ label, hint, error, required, optionalLabel, className, ...props }, ref) {
  const id = useFieldId(props.id)
  return (
    <FormField
      label={label}
      htmlFor={id}
      hint={hint}
      error={error}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
    >
      {(meta) => (
        <PasswordInput
          {...props}
          ref={ref}
          id={meta.id}
          name={props.name ?? meta.id}
          aria-describedby={meta['aria-describedby']}
          aria-required={meta['aria-required']}
          invalid={Boolean(error)}
        />
      )}
    </FormField>
  )
})

/**
 * CheckmarkList: short reassurance points under a form or a decision.
 * Not a checklist of tasks (that is ChecklistItem); this is supporting copy.
 */
export function CheckmarkList({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-[12px] leading-[1.5] text-[var(--dash-ink-3)]">
          <Check className="mt-[2px] size-3.5 shrink-0 text-[var(--dash-success)]" aria-hidden="true" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  )
}
