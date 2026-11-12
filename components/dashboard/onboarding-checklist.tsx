'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProgressLine } from '@/components/dashboard/stepper'
import { ChecklistItem } from '@/components/dashboard/checklist-item'
import { toast } from '@/components/dashboard/toast'
import type { OnboardingStep, OnboardingSummary } from '@/lib/onboarding'

/**
 * The checklist itself. Owns the skip interaction and keeps the server copy in
 * sync; everything else is server-rendered data passed down as props.
 */
export function OnboardingChecklist({
  initial,
  businessName,
  storefrontUrl,
}: {
  initial: OnboardingSummary
  businessName: string
  storefrontUrl?: string | null
}) {
  const router = useRouter()
  const [summary, setSummary] = React.useState<OnboardingSummary>(initial)
  const [pending, setPending] = React.useState<string | null>(null)

  const available = summary.steps.filter((step) => step.status !== 'locked')
  const remaining = available.filter((step) => step.status !== 'done')
  const locked = summary.steps.filter((step) => step.status === 'locked')

  const toggleSkip = async (step: OnboardingStep) => {
    const skipping = step.status !== 'skipped'
    setPending(step.key)
    // Optimistic: the checklist is not a source of truth, so the worst case of a
    // failed write is that the step snaps back on refresh.
    setSummary((current) => ({
      ...current,
      steps: current.steps.map((entry) =>
        entry.key === step.key ? { ...entry, status: skipping ? 'skipped' : 'todo' } : entry,
      ),
    }))

    try {
      const response = await fetch('/api/business/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_key: step.key, skip: skipping }),
      })
      const data = await response.json().catch(() => ({}))
      if (data?.steps) {
        setSummary({ steps: data.steps, progress: data.progress })
      }
      if (data?.success === false) {
        toast.info('Saved on this screen only', {
          description: 'The checklist recalculates from your data, so this is safe to ignore.',
        })
      } else if (skipping) {
        toast.success('Step skipped', { description: 'You can come back to it at any time.' })
      }
    } catch {
      toast.error('Could not save that', { description: 'Check your connection and try again.' })
      setSummary(initial)
    } finally {
      setPending(null)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[12.5px] text-[var(--dash-ink-2)]">
            <span className="dash-num font-semibold text-[var(--dash-ink-1)]">{summary.progress.done}</span> of{' '}
            <span className="dash-num">{summary.progress.total}</span> steps done
          </p>
          {summary.progress.complete ? (
            <p className="text-[12px] font-medium text-[var(--dash-success)]">
              Everything needed to take orders is in place.
            </p>
          ) : (
            <p className="text-[12px] text-[var(--dash-ink-3)]">
              About {Math.max(2, remaining.reduce((total, step) => total + step.minutes, 0))} minutes left
            </p>
          )}
        </div>
        <ProgressLine
          value={summary.progress.percent}
          label={`${businessName} setup`}
          tone={summary.progress.complete ? 'success' : 'brand'}
        />
      </div>

      {summary.progress.complete ? (
        <div className="rounded-[10px] border border-[var(--dash-success)]/25 bg-[var(--dash-success-bg)] px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--dash-success)]">Setup complete</p>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">
            Your storefront is taking orders. Share the link with customers and keep an eye on the orders board
            during service.
          </p>
        </div>
      ) : null}

      <ul className="divide-y divide-[var(--dash-line)] rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)]">
        {summary.steps.map((step, index) => (
          <ChecklistItem
            key={step.key}
            index={index + 1}
            title={step.title}
            why={step.why}
            minutes={step.minutes}
            status={step.status}
            href={step.href}
            actionLabel={step.status === 'skipped' ? 'Set it up' : 'Start'}
            lockedReason={step.lockedReason}
            onSkip={step.critical || step.status === 'locked' ? undefined : () => void toggleSkip(step)}
            skipLabel={pending === step.key ? 'Saving…' : 'Skip for now'}
          />
        ))}
      </ul>

      {locked.length > 0 ? (
        <p className="text-[12px] leading-[1.5] text-[var(--dash-ink-3)]">
          Steps marked “Coming next” are not available in this version. They are left here so you can see what
          is planned, and progress is measured only against the steps you can actually finish today.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="dash-tap inline-flex h-10 items-center rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-3.5 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
        >
          Back to dashboard
        </Link>
        {summary.progress.complete && storefrontUrl ? (
          <Link
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dash-tap inline-flex h-10 items-center rounded-[8px] bg-[var(--dash-brown)] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)]"
          >
            Open your storefront
          </Link>
        ) : null}
      </div>
    </div>
  )
}
