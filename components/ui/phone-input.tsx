'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * PhoneInput, Nigerian by default.
 *
 * The country code is not something the customer types: it is fixed at +234 and
 * shown in the field, so the only thing on the keypad is the number they know.
 * A leading zero ("0803…") and a full international number ("+234803…") are both
 * accepted and normalised, because people paste both.
 *
 * `onValueChange` always receives E.164 ("+2348031234567"), which is what the
 * database and the SMS provider expect. The digits are grouped 3-3-4 for
 * reading; the emitted value never contains a space.
 */

const DIAL_CODE = '+234'
const NATIONAL_LENGTH = 10

export type PhoneInputProps = {
  value?: string
  defaultValue?: string
  onValueChange?: (e164: string) => void
  id?: string
  name?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  placeholder?: string
  className?: string
  'aria-describedby'?: string
}

/** Everything the customer might paste, reduced to the 10 national digits. */
function toNational(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234')) digits = digits.slice(3)
  digits = digits.replace(/^0+/, '')
  return digits.slice(0, NATIONAL_LENGTH)
}

function toE164(national: string): string {
  return national ? `${DIAL_CODE}${national}` : ''
}

/** 803 123 4567 */
function group(national: string): string {
  const parts = [national.slice(0, 3), national.slice(3, 6), national.slice(6, 10)]
  return parts.filter(Boolean).join(' ')
}

export function PhoneInput({
  value,
  defaultValue,
  onValueChange,
  id,
  name,
  disabled = false,
  required = false,
  invalid = false,
  placeholder = '803 123 4567',
  className,
  'aria-describedby': describedBy,
}: PhoneInputProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState(() => toNational(defaultValue ?? ''))
  const national = isControlled ? toNational(value ?? '') : internal

  const commit = (next: string) => {
    if (!isControlled) setInternal(next)
    onValueChange?.(toE164(next))
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    commit(toNational(event.target.value))
  }

  return (
    <div
      data-slot="phone-input"
      className={cn(
        'flex h-11 w-full items-center rounded-[var(--radius-control)] border border-line-strong bg-surface',
        'transition-colors duration-[120ms] ease-brand',
        'hover:border-ink-muted focus-within:border-primary',
        invalid && 'border-danger',
        disabled && 'cursor-not-allowed bg-muted',
        className,
      )}
    >
      <span
        aria-hidden
        className="flex h-full items-center border-r border-line px-3 type-body font-medium text-ink-muted"
      >
        {DIAL_CODE}
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={group(national)}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder}
        className={cn(
          'h-full w-full min-w-0 rounded-r-[var(--radius-control)] bg-transparent px-3',
          'type-body text-ink placeholder:text-ink-muted',
          'focus-visible:outline-none',
          'disabled:cursor-not-allowed',
        )}
      />
    </div>
  )
}

/** The E.164 value for a national number, for a form that only stores digits. */
export function toNigerianE164(national: string): string {
  return toE164(toNational(national))
}
