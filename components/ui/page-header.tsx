import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * PageHeader. The top of every screen: an optional breadcrumb, the page title
 * in the display face, one sentence of context and the page's actions.
 *
 * On a phone the actions stack under the title at full width; from 640 px they
 * sit beside it. The title is always the h1 of the page, so a screen never has
 * two.
 */
export type PageHeaderProps = {
  title: string
  description?: string
  breadcrumb?: React.ReactNode
  actions?: React.ReactNode
  /** Extra content under the description, e.g. a status badge row. */
  meta?: React.ReactNode
  className?: string
  /**
   * The heading level. h1 by default, because a page has one header. Pass h2
   * when the header is nested inside another page's content (a preview, a
   * specimen, a sub-view that is not its own route).
   */
  as?: 'h1' | 'h2'
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  className,
  as = 'h1',
}: PageHeaderProps) {
  const Heading = as
  return (
    <header
      data-slot="page-header"
      className={cn('flex flex-col gap-4 border-b border-line pb-5', className)}
    >
      {breadcrumb ? <div className="min-w-0">{breadcrumb}</div> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Heading className={as === 'h1' ? 'type-h1 text-ink' : 'type-h2 text-ink'}>
            {title}
          </Heading>
          {description ? (
            <p className="max-w-[65ch] type-small text-ink-muted">{description}</p>
          ) : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}
