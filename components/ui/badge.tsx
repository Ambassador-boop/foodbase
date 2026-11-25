import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Badge. A short word in a tinted rectangle: 8 px radius, 12/16 text, medium
 * weight. Every variant pairs a colour with a word, and StatusBadge below adds
 * an icon as well, so no state is ever carried by colour alone.
 */
const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap',
    'rounded-[var(--radius-control)] px-2 py-0.5 type-caption font-medium',
    "[&>svg]:pointer-events-none [&>svg]:size-3.5",
    'transition-colors duration-[120ms] ease-brand',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white [a&]:hover:bg-brand-700',
        secondary: 'bg-brand-100 text-brand-800 [a&]:hover:bg-brand-200',
        outline: 'border border-line-strong bg-transparent text-ink [a&]:hover:bg-brand-50',
        destructive: 'bg-danger text-white [a&]:hover:opacity-90',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        neutral: 'bg-neutral-soft text-neutral',
        brand: 'bg-brand-50 text-brand-700',
        // Settlements are a transfer, not a credit: warm neutral, never green.
        settled: 'bg-[var(--settle-bg)] text-[var(--settle)]',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
