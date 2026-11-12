'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Landmark, Receipt } from 'lucide-react'

import { Card } from '@/components/ui/card'
import {
  RefundedAfterSettlement,
  ScheduleNote,
  StatementCards,
  StatementEmpty,
  StatementError,
  StatementSkeleton,
  StatementSummaryCard,
  StatementTable,
  settledTimeLabel,
} from '@/components/finance/settlement-statement'
import type { Statement } from '@/components/finance/settlement-statement'
import { formatWat } from '@/lib/wat'

export default function SettlementPage() {
  const params = useParams<{ settlementDate: string }>()
  const settlementDate = decodeURIComponent(params?.settlementDate || '').slice(0, 10)

  const [data, setData] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!settlementDate) return
    const controller = new AbortController()

    async function load() {
      try {
        const response = await fetch(`/api/business/settlements/${settlementDate}`, {
          credentials: 'include',
          signal: controller.signal,
        })
        const body = await response.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!response.ok) {
          setError(
            response.status === 404
              ? 'This settlement is not available for your business.'
              : 'Something went wrong while loading this statement.',
          )
          setData(null)
          return
        }
        setData(body as Statement)
        setError(null)
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setError('Something went wrong while loading this statement.')
        setData(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [settlementDate, attempt])

  const date = settlementDate ? new Date(`${settlementDate}T12:00:00`) : null
  const title = date
    ? formatWat(date, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Settlement'

  const settledAt = data?.summary ? settledTimeLabel(data.summary.settled_at) : null
  const orders = Number(data?.summary?.orders || 0)
  const rows = data?.settlements ?? []

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 md:space-y-5">
      <div className="flex flex-col gap-2">
        <Link
          href="/dashboard/finance"
          className="inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to finance
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Landmark className="size-3.5" aria-hidden="true" />
              Settlement statement
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading && !data
                ? 'Loading settlement times…'
                : settledAt
                  ? `Settled at ${settledAt} WAT${orders ? ` · ${orders} ${orders === 1 ? 'order' : 'orders'}` : ''}`
                  : 'No settlement time recorded'}
            </p>
          </div>
          {!!orders && (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--settle-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--settle)]">
              <Receipt className="size-3.5" aria-hidden="true" />
              {orders} {orders === 1 ? 'order' : 'orders'} in this statement
            </p>
          )}
        </div>
      </div>

      {loading && !data && <StatementSkeleton />}

      {!loading && error && <StatementError onRetry={retry} message={error} />}

      {!loading && !error && data && rows.length === 0 && (
        <>
          <StatementEmpty />
          <ScheduleNote />
        </>
      )}

      {data && rows.length > 0 && (
        <>
          <StatementSummaryCard summary={data.summary} />

          <section className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Orders in this settlement</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Every order whose money moved into your available balance.
                </p>
              </div>
            </div>
            <StatementTable rows={rows} />
            <StatementCards rows={rows} />
          </section>

          <RefundedAfterSettlement rows={data.refunds_after_settlement ?? []} />

          <ScheduleNote />
        </>
      )}

      {!loading && !data && !error && settlementDate && (
        <Card className="p-5 text-sm text-muted-foreground">
          No settlement data for {settlementDate}.
        </Card>
      )}
    </main>
  )
}
