'use client'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '@/components/admin/ui'
import { count, money, moneyCompact, relativeDay } from '@/components/admin/format'
import type { DailyPoint } from '@/lib/admin-analytics'

const axisStyle = { fontSize: 11, fill: 'var(--muted-foreground)' }

function ChartEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border px-4 py-8 text-center">
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-[12px] leading-5 text-muted-foreground">{description}</p>
    </div>
  )
}

interface TooltipEntry {
  name?: string
  dataKey?: string | number
  value?: number | string
  color?: string
  payload?: Record<string, unknown>
}

function ChartTooltip({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  rows: Array<{ key: string; label: string; format?: (value: number) => string }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]?.payload ?? {}
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-sm">
      <p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {typeof label === 'string' ? relativeDay(label) : label}
      </p>
      <div className="space-y-0.5">
        {rows.map((row) => {
          const raw = point[row.key]
          const value = Number(raw ?? 0)
          return (
            <div key={row.key} className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="num font-medium text-foreground">{row.format ? row.format(value) : count(value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Daily net revenue, with the fee components available in the tooltip. */
export function RevenueTrendChart({ data }: { data: DailyPoint[] }) {
  const hasData = data.some((point) => point.net !== 0 || point.serviceFees !== 0 || point.withdrawalFees !== 0)
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">
        Daily net platform revenue for the selected range. Net revenue is service fees plus withdrawal fees, minus
        recorded Paystack fees.
      </figcaption>
      {hasData ? (
        <div className="h-[220px] w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={axisStyle}
                minTickGap={24}
                tickFormatter={(value: string) => relativeDay(value)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisStyle}
                width={52}
                tickFormatter={(value: number) => moneyCompact(value)}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                content={
                  <ChartTooltip
                    rows={[
                      { key: 'net', label: 'Net revenue', format: money },
                      { key: 'serviceFees', label: 'Service fees', format: money },
                      { key: 'withdrawalFees', label: 'Withdrawal fees', format: money },
                      { key: 'paystackFees', label: 'Paystack fees', format: money },
                    ]}
                  />
                }
              />
              <Bar dataKey="net" name="Net revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty
          title="No revenue booked in this range"
          description="Service fees and withdrawal fees appear here once an order is paid. The chart starts filling the first time a customer completes checkout."
        />
      )}
    </figure>
  )
}

/** Daily payments volume and paid order count. */
export function VolumeTrendChart({ data }: { data: DailyPoint[] }) {
  const hasData = data.some((point) => point.volume > 0 || point.paidOrders > 0)
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">Daily payments volume and paid orders for the selected range.</figcaption>
      {hasData ? (
        <div className="h-[220px] w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={axisStyle}
                minTickGap={24}
                tickFormatter={(value: string) => relativeDay(value)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={axisStyle}
                width={52}
                tickFormatter={(value: number) => moneyCompact(value)}
              />
              <Tooltip
                cursor={{ stroke: 'var(--border)' }}
                content={
                  <ChartTooltip
                    rows={[
                      { key: 'volume', label: 'Payments volume', format: money },
                      { key: 'paidOrders', label: 'Paid orders', format: count },
                    ]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="volume"
                name="Payments volume"
                stroke="var(--chart-5)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmpty
          title="No payments yet in this range"
          description="This chart plots the value of paid orders per day. It stays empty until the first successful checkout."
        />
      )}
    </figure>
  )
}

/** Order funnel with direct labels; plain elements so the numbers stay readable at 360px. */
export function FunnelBreakdown({
  funnel,
}: {
  funnel: { created: number; paid: number; failed: number; abandoned: number; inProgress: number; conversionRate: number | null }
}) {
  const stages = [
    { key: 'created', label: 'Orders created', value: funnel.created, tone: 'bg-primary' },
    { key: 'paid', label: 'Paid', value: funnel.paid, tone: 'bg-[var(--success)]' },
    { key: 'failed', label: 'Failed or cancelled', value: funnel.failed, tone: 'bg-[var(--danger)]' },
    { key: 'abandoned', label: 'Abandoned before payment', value: funnel.abandoned, tone: 'bg-[var(--warning)]' },
  ]
  const max = Math.max(1, funnel.created)
  if (funnel.created === 0) {
    return (
      <ChartEmpty
        title="No orders created in this range"
        description="The funnel shows how many storefront orders were created, paid, failed or abandoned."
      />
    )
  }
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[12px] text-muted-foreground">{stage.label}</span>
            <span className="num text-[13px] font-medium text-foreground">
              {count(stage.value)}
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                {Math.round((stage.value / max) * 100)}%
              </span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={stage.tone} style={{ width: `${Math.max(1, (stage.value / max) * 100)}%`, height: '100%' }} />
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-border pt-3 text-[12px] text-muted-foreground">
        <span>Conversion to paid</span>
        <span className="num text-[13px] font-semibold text-foreground">
          {funnel.conversionRate === null ? '—' : `${funnel.conversionRate.toFixed(1)}%`}
        </span>
      </div>
      {funnel.inProgress > 0 ? (
        <p className="text-[11px] text-muted-foreground">{count(funnel.inProgress)} order(s) created in the last hour are still awaiting payment.</p>
      ) : null}
    </div>
  )
}

export function WithdrawalStatusChart({
  rows,
}: {
  rows: Array<{ status: string; count: number; amount: number; fee: number }>
}) {
  if (rows.length === 0) {
    return (
      <ChartEmpty
        title="No withdrawals in this range"
        description="Withdrawal requests, their fees and their outcomes appear here once a business requests a payout."
      />
    )
  }
  const colours: Record<string, string> = {
    success: 'var(--chart-2)',
    completed: 'var(--chart-2)',
    processed: 'var(--chart-2)',
    pending: 'var(--chart-3)',
    processing: 'var(--chart-3)',
    approved: 'var(--chart-3)',
    failed: 'var(--destructive)',
    rejected: 'var(--destructive)',
    reversed: 'var(--destructive)',
    blocked: 'var(--destructive)',
    abandoned: 'var(--chart-4)',
  }
  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.status} className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: colours[row.status] ?? 'var(--chart-4)' }}
              aria-hidden="true"
            />
            <span className="truncate text-[12px] capitalize text-muted-foreground">{row.status.replace(/_/g, ' ')}</span>
          </span>
          <span className="num shrink-0 text-[13px] font-medium text-foreground">
            {count(row.count)}
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">{money(row.amount)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/** Small horizontal bars used for top-business rankings. */
export function RankedBars({
  rows,
}: {
  rows: Array<{ id: string; label: string; value: number; secondary?: string }>
}) {
  if (rows.length === 0) {
    return (
      <ChartEmpty
        title="No business has taken a payment in this range"
        description="Paid volume by business appears here as soon as the first order is paid."
      />
    )
  }
  const max = Math.max(...rows.map((row) => row.value), 1)
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px] font-medium text-foreground">{row.label}</span>
            <span className="num shrink-0 text-[12px] text-muted-foreground">{money(row.value)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
          </div>
          {row.secondary ? <p className="mt-1 text-[11px] text-muted-foreground">{row.secondary}</p> : null}
        </div>
      ))}
    </div>
  )
}

export { Panel, Cell, Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer }
