'use client'

import * as React from 'react'
import { WarningOctagon } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * ErrorState. What went wrong, in plain words, and the one thing to do about
 * it. The icon is 20 px and the text is ink: an error is not a red alarm, it is
 * a problem with a next step. Red is reserved for the one word that marks the
 * failure, so the block stays readable.
 */
export type ErrorStateProps = {
  title: string
  description?: string
  /**
   * A retry handler. Only usable from a client component: a server component
   * cannot pass a function across the boundary. From a server page use
   * `retryHref` instead.
   */
  onRetry?: () => void
  /** A link back to the thing that failed, for a server-rendered page. */
  retryHref?: string
  retryLabel?: string
  /** An error reference for support, e.g. a request id. */
  reference?: string
  className?: string
  children?: React.ReactNode
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryHref,
  retryLabel = 'Try again',
  reference,
  className,
  children,
}: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-card px-5 py-6',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <WarningOctagon className="mt-0.5 size-5 shrink-0 text-danger" weight="bold" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="type-body font-medium text-ink">{title}</p>
          {description ? (
            <p className="max-w-[55ch] type-small text-ink-muted">{description}</p>
          ) : null}
          {reference ? (
            <p className="type-caption text-ink-muted">
              Reference <span className="font-mono">{reference}</span>
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="pl-8">{children}</div> : null}
      {onRetry || retryHref ? (
        <div className="pl-8">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            {...(retryHref ? { asChild: true } : {})}
          >
            {retryHref ? <a href={retryHref}>{retryLabel}</a> : retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
