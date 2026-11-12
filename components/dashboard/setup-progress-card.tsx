'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/dashboard/empty-state'
import type { OnboardingSummary } from '@/lib/onboarding'

/**
 * Compact setup card for /dashboard.
 *
 * It disappears once every available step is done, so the dashboard returns to
 * being a dashboard. It never blocks anything: if the request fails it renders
 * nothing rather than an error, because the owner did not ask for it here.
 */
export function SetupProgressCard() {
  const [summary, setSummary] = React.useState<OnboardingSummary | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/business/onboarding', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data?.steps) setSummary({ steps: data.steps, progress: data.progress })
        else setFailed(true)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed) return null
  if (!summary) {
    return (
      <div className="dash-surface" aria-busy="true">
        <Skeleton className="h-[74px] w-full rounded-[10px]" />
      </div>
    )
  }
  if (summary.progress.complete) return null

  const nextStep =
    summary.steps.find((step) => step.status === 'todo') ??
    summary.steps.find((step) => step.status === 'skipped') ??
    null
  const remaining = summary.steps.filter((step) => step.status === 'todo' || step.status === 'skipped')
  const minutes = remaining.reduce((total, step) => total + step.minutes, 0)

  return (
    <section
      aria-label="Setup progress"
      className="dash-surface overflow-hidden rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)]"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-brown)]">
            Setup
          </p>
          <p className="mt-1 text-[13.5px] font-semibold leading-5 text-[var(--dash-ink-1)]">
            {remaining.length === 0
              ? 'Last step left'
              : `${remaining.length} step${remaining.length === 1 ? '' : 's'} until your storefront is ready`}
          </p>
          <p className="mt-0.5 text-[12px] leading-[1.45] text-[var(--dash-ink-3)]">
            {nextStep ? (
              <>
                Next: {nextStep.title}.{' '}
                <span className="text-[var(--dash-ink-4)]">About {minutes} min in total.</span>
              </>
            ) : (
              'Everything is done.'
            )}
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-4 sm:shrink-0">
          <div className="min-w-[96px] flex-1 sm:w-32 sm:flex-none">
            <div className="flex items-baseline justify-between gap-2">
              <span className="dash-num text-[12px] font-semibold text-[var(--dash-ink-1)]">
                {summary.progress.done}/{summary.progress.total}
              </span>
              <span className="dash-num text-[11px] text-[var(--dash-ink-4)]">{summary.progress.percent}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--dash-line)]">
              <div
                className="h-full rounded-full bg-[var(--dash-brown)] transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(4, summary.progress.percent)}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
          <Link
            href="/dashboard/onboarding"
            className="dash-tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-[var(--dash-line-strong)] px-3 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:border-[var(--dash-brown)] hover:text-[var(--dash-brown)]"
          >
            {nextStep ? 'Continue setup' : 'Review'}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
