import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Input. 44 px high on every screen (the touch target), 8 px radius, a real
 * border in --line-strong so the field is identifiable at 3:1, and 16 px text
 * on mobile so iOS does not zoom on focus (enforced in the base layer too).
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2',
        'type-body text-ink placeholder:text-ink-muted',
        'transition-colors duration-[120ms] ease-brand',
        'hover:border-ink-muted focus-visible:border-primary',
        'file:mr-3 file:inline-flex file:h-7 file:items-center file:rounded-[var(--radius-control)] file:border-0 file:bg-brand-100 file:px-2 file:type-small file:font-medium file:text-brand-800',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-muted',
        'aria-invalid:border-danger',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
