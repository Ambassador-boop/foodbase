import { cn } from '@/lib/utils'

/**
 * Skeleton. A flat cream block, not a shimmer: a moving gradient is banned, and
 * a pulse on a large surface is noise. It carries `aria-hidden` and the region
 * around it announces "loading" in words through the caller.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-[var(--radius-control)] bg-brand-50', className)}
      {...props}
    />
  )
}

export { Skeleton }
