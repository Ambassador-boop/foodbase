import * as React from 'react'

import { cn } from '@/lib/utils'

/** Textarea. Same border, radius and text rules as Input, with room to breathe. */
function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-24 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2.5',
        'type-body text-ink placeholder:text-ink-muted',
        'transition-colors duration-[120ms] ease-brand',
        'hover:border-ink-muted focus-visible:border-primary',
        'disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-muted',
        'aria-invalid:border-danger',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
