import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleNotch } from '@phosphor-icons/react/dist/ssr'

import { cn } from '@/lib/utils'

/**
 * Button.
 *
 * Three heights only: 36 (sm), 44 (default, the touch target) and 52 (lg, the
 * one action at the bottom of a phone screen). Radius is the control radius,
 * 8 px. No gradient, no glow, one flat fill and a darker fill on press.
 *
 * Focus is the system treatment: a 2 px brand ring with a 2 px offset, drawn by
 * the base layer in styles/globals.css. It is never removed here, which is why
 * there is no `outline-none` in these classes.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-[var(--radius-control)] font-medium select-none',
    'transition-colors duration-[120ms] ease-brand',
    'disabled:pointer-events-none disabled:opacity-50',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    'aria-busy:cursor-progress',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-700 active:bg-brand-800',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-brand-200 active:bg-brand-300',
        outline:
          'border border-line-strong bg-surface text-ink hover:bg-brand-50 active:bg-brand-100',
        ghost: 'bg-transparent text-ink hover:bg-brand-50 active:bg-brand-100',
        destructive: 'bg-danger text-white hover:bg-[#961F18] active:bg-[#7E1A14]',
        link: 'bg-transparent text-link underline underline-offset-4 hover:no-underline px-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 type-small gap-1.5 [&_svg:not([class*="size-"])]:size-4',
        default: 'h-11 px-4 type-small',
        lg: 'h-13 px-6 type-body',
        icon: 'size-11',
        'icon-sm': 'size-9',
        'icon-lg': 'size-13',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, marks the button busy and blocks a second press. */
    loading?: boolean
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  // asChild hands the classes to a single child element (usually a Link), so a
  // spinner cannot be injected there without breaking its layout. The busy
  // state is still announced.
  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-loading={loading ? '' : undefined}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <button
      data-slot="button"
      data-loading={loading ? '' : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <CircleNotch className="size-4 animate-spin" weight="bold" aria-hidden />
      ) : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants }
