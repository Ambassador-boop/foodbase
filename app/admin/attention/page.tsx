'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader, Panel, StatusPill, TableSkeleton } from '@/components/admin/ui'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateTimeWat } from '@/components/admin/format'
import type { AttentionItem, AttentionResponse } from '@/components/admin/types'

type Category = 'all' | 'anomalies' | 'stuckWithdrawals' | 'stuckRefunds' | 'pendingTransfers' | 'paidWithoutTransaction'

const CATEGORY_META: Array<{
  key: Exclude<Category, 'all'>
  label: string
  short: string
  explanation: string
  icon: React.ElementType
}> = [
  {
    key: 'anomalies',
    label: 'Balance anomalies',
    short: 'Balances',
    explanation: 'A stored business balance does not match the payments, refunds and withdrawals the ledger can prove.',
    icon: AlertTriangle,
  },
  {
    key: 'paidWithoutTransaction',
    label: 'Paid without a payment record',
    short: 'Paid orders',
    explanation: 'An order is marked paid but has no payment transaction, so the money cannot be tied to a provider charge.',
    icon: AlertTriangle,
  },
  {
    key: 'stuckWithdrawals',
    label: 'Withdrawals stuck',
    short: 'Withdrawals',
    explanation: 'A payout has been pending for more than 30 minutes and needs to be checked with the provider.',
    icon: AlertTriangle,
  },
  {
    key: 'stuckRefunds',
    label: 'Refunds stuck',
    short: 'Refunds',
    explanation: 'A refund has been pending for more than 48 hours and needs follow up.',
    icon: AlertTriangle,
  },
  {
    key: 'pendingTransfers',
    label: 'Platform transfers',
    short: 'Transfers',
    explanation: 'A platform transfer is not finished, or failed after the balance was deducted and needs a reversal.',
    icon: AlertTriangle,
  },
]

function severityTone(severity: AttentionItem['severity']) {
  if (severity === 'danger') return 'danger' as const
  if (severity === 'warning') return 'warning' as const
  return 'neutral' as const
}

export default function AlertsPage() {
  const { data, loading, error, reload } = useAdminData<AttentionResponse>('/api/admin/attention')
  const [category, setCategory] = React.useState<Category>('all')
  const [visible, setVisible] = React.useState(20)
  const [resolving, setResolving] = React.useState<Record<string, boolean>>({})
  const [message, setMessage] = React.useState<{ tone: 'success' | 'danger'; text: string } | null>(null)

  const items = React.useMemo<AttentionItem[]>(() => {
    if (!data) return []
    return [
      ...data.rows.anomalies,
      ...data.rows.paidWithoutTransaction,
      ...data.rows.stuckWithdrawals,
      ...data.rows.stuckRefunds,
      ...data.rows.pendingTransfers,
    ].sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2 }
      const severity = rank[a.severity] - rank[b.severity]
      if (severity !== 0) return severity
      return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    })
  }, [data])

  const filtered = React.useMemo(() => {
    if (category === 'all') return items
    return items.filter((item) => {
      if (category === 'anomalies') return item.kind === 'payment_anomaly' || item.kind === 'negative_balance' || item.kind === 'unreconciled_balance'
      if (category === 'stuckWithdrawals') return item.kind === 'stuck_withdrawal'
      if (category === 'stuckRefunds') return item.kind === 'stuck_refund'
      if (category === 'pendingTransfers') return item.kind === 'admin_transfer'
      if (category === 'paidWithoutTransaction') return item.kind === 'paid_without_transaction'
      return true
    })
  }, [items, category])

  const resolve = async (item: AttentionItem) => {
    setResolving((current) => ({ ...current, [item.id]: true }))
    setMessage(null)
    try {
      const response = await fetch('/api/admin/attention', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind, id: item.id }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'Could not resolve this alert')
      setMessage({ tone: 'success', text: 'Alert resolved.' })
      reload()
    } catch (requestError) {
      setMessage({
        tone: 'danger',
        text: requestError instanceof Error ? requestError.message : 'Could not resolve this alert',
      })
    } finally {
      setResolving((current) => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
  }

  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Alerts"
        description="Everything that needs a person: balance mismatches, stuck payouts, failed transfers and payments without a record."
        meta={
          <>
            <span className={total > 0 ? 'font-medium text-[var(--danger)]' : 'font-medium text-[var(--success)]'}>
              {total > 0 ? `${count(total)} open` : 'All clear'}
            </span>
            {data ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Checked {dateTimeWat(data.generatedAt)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={reload} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />}
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {message ? (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] ${
            message.tone === 'success'
              ? 'border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)]'
              : 'border-[var(--danger)]/30 bg-[var(--danger-bg)] text-[var(--danger)]'
          }`}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {message.text}
        </div>
      ) : null}

      <section aria-label="Alert categories" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            setCategory('all')
            setVisible(20)
          }}
          aria-pressed={category === 'all'}
          className={`flex min-h-16 flex-col justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
            category === 'all' ? 'border-primary bg-accent/50' : 'border-border bg-card hover:bg-muted/40'
          }`}
        >
          <span className="text-[12px] text-muted-foreground">All alerts</span>
          <span className={`num text-[20px] font-semibold ${total > 0 ? 'text-foreground' : 'text-[var(--success)]'}`}>{count(total)}</span>
        </button>
        {CATEGORY_META.map((meta) => {
          const value = data ? data[meta.key] : 0
          const active = category === meta.key
          return (
            <button
              key={meta.key}
              type="button"
              onClick={() => {
                setCategory(meta.key)
                setVisible(20)
              }}
              aria-pressed={active}
              className={`flex min-h-16 flex-col justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active ? 'border-primary bg-accent/50' : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <span className="text-[12px] text-muted-foreground">{meta.short}</span>
              <span className={`num text-[20px] font-semibold ${value > 0 ? 'text-[var(--danger)]' : 'text-muted-foreground'}`}>{count(value)}</span>
            </button>
          )
        })}
      </section>

      <Panel
        title={category === 'all' ? 'All open items' : CATEGORY_META.find((meta) => meta.key === category)?.label}
        description={category === 'all' ? 'Highest severity first. Each item links to the record that needs fixing.' : CATEGORY_META.find((meta) => meta.key === category)?.explanation}
        action={
          filtered.length > 0 ? (
            <span className="text-[12px] text-muted-foreground">
              Showing {Math.min(visible, filtered.length)} of {count(filtered.length)}
            </span>
          ) : null
        }
      >
        {loading && !data ? (
          <TableSkeleton rows={5} columns={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={category === 'all' ? 'Nothing needs attention' : 'Nothing in this category'}
            description={
              category === 'all'
                ? 'Balances reconcile, every paid order has a payment record, and no payout is stuck. This page re-checks every time you open or refresh it.'
                : 'This category is empty for now. Switch back to all alerts to see the rest of the queue.'
            }
            action={
              category !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => setCategory('all')}>
                  Show all alerts
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {filtered.slice(0, visible).map((item) => (
                <li key={`${item.kind}:${item.id}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={severityTone(item.severity)}>{item.kind.replace(/_/g, ' ')}</StatusPill>
                      <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{item.detail}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {item.created_at ? <span>{dateTimeWat(item.created_at)}</span> : null}
                      {item.status ? <span className="capitalize">Status: {item.status.replace(/_/g, ' ')}</span> : null}
                      {item.amount !== null && item.amount !== undefined ? (
                        <span className="num">
                          {item.kind === 'unreconciled_balance' ? 'Gap ' : ''}
                          {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(item.amount)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                    {item.href ? (
                      <Button asChild variant="outline" size="sm" className="h-8 gap-1">
                        <Link href={item.href}>
                          Open
                          <ArrowRight className="size-3" aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : null}
                    {item.resolvable ? (
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => resolve(item)}
                        disabled={Boolean(resolving[item.id])}
                      >
                        {resolving[item.id] ? 'Resolving…' : 'Resolve'}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {visible < filtered.length ? (
              <div className="mt-3 flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setVisible((current) => current + 20)}>
                  Load 20 more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <p className="text-[11px] leading-5 text-muted-foreground">
        Alerts are read-only checks. Resolving a provider-reported anomaly records the decision; every other item clears itself
        once the underlying record is corrected in the payments flow.
      </p>
    </div>
  )
}
