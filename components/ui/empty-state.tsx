import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * EmptyState. One sentence and one action. No illustration, no icon, no
 * decorative shape: an empty list is not a moment that needs artwork, it is a
 * moment that needs the next step.
 */
export type EmptyStateProps = {
  /** A sentence, e.g. "No orders yet today." */
  title: string
  /** One line of explanation, optional. */
  description?: string
  /** Exactly one action. */
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-card px-5 py-8',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="type-body font-medium text-ink">{title}</p>
        {description ? (
          <p className="max-w-[55ch] type-small text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  )
}
