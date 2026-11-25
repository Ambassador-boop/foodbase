import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * SectionHeading. The heading of a block inside a page: a title, one line of
 * context, and at most one action on the right. Smaller than PageHeader on
 * purpose, so a page reads as a hierarchy rather than a stack of equal titles.
 */
export type SectionHeadingProps = {
  title: string
  description?: string
  action?: React.ReactNode
  /** h2 by default; pass 3 inside a card that already sits under an h2. */
  as?: 'h2' | 'h3'
  className?: string
  id?: string
}

export function SectionHeading({
  title,
  description,
  action,
  as = 'h2',
  className,
  id,
}: SectionHeadingProps) {
  const Heading = as
  return (
    <div
      data-slot="section-heading"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <Heading id={id} className={as === 'h2' ? 'type-h2 text-ink' : 'type-h3 text-ink'}>
          {title}
        </Heading>
        {description ? (
          <p className="max-w-[65ch] type-small text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}
