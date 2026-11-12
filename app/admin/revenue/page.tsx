'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, ArrowUpRight, Download, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  Delta,
  EmptyState,
  ErrorState,
  KeyValue,
  MobileRow,
  Money,
  PageHeader,
  Panel,
  PanelSkeleton,
  StatTile,
  TableSkeleton,
  type Column,
} from '@/components/admin/ui'
import { RankedBars, RevenueTrendChart } from '@/components/admin/charts'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateWat, money, percent, timeWat } from '@/components/admin/format'
import type { RevenueResponse } from '@/components/admin/types'

function changePct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

type FeeRow = RevenueResponse['recentTransactions'][number]

export default function RevenuePage() {
  const { query, label } = useAdminRange()
  const { data, loading, error, reload } = useAdminData<RevenueResponse>(`/api/admin/revenue?${query}`)

  const components = data?.components
  const dailyPoints = React.useMemo(() => {
    if (!data) return []
    const byDate = new Map(data.dailyBreakdown.map((day) => [day.date, day]))
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, day]) => ({
        date,
        volume: 0,
        paidOrders: day.transaction_count,
        serviceFees: day.daily_revenue,
        paystackFees: 0,
        withdrawalFees: 0,
        net: day.daily_revenue,
        ordersCreated: 0,
        ordersFailed: 0,
      }))
  }, [data])

  const feeColumns: Column<FeeRow>[] = [
    {
      key: 'business',
      header: 'Business',
      sortValue: (row) => row.business_name,
      render: (row) => <span className="truncate font-medium">{row.business_name}</span>,
    },
    {
      key: 'order_id',
      header: 'Order',
      render: (row) => <span className="font-mono text-[11px] text-muted-foreground">{String(row.order_id).slice(0, 14)}</span>,
    },
    {
      key: 'amount',
      header: 'Service fee',
      align: 'right',
      sortValue: (row) => row.service_fee_amount,
      render: (row) => <Money value={row.service_fee_amount} className="font-medium" />,
    },
    {
      key: 'total',
      header: 'Order value',
      align: 'right',
      sortValue: (row) => row.total_amount,
      render: (row) => <Money value={row.total_amount} />,
    },
    {
      key: 'created_at',
      header: 'Paid',
      align: 'right',
      sortValue: (row) => row.created_at,
      render: (row) => <span className="text-[12px] text-muted-foreground">{dateWat(row.created_at)}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Revenue"
        description="What FoodBase earns: service fees on paid orders, withdrawal fees, minus provider costs."
        meta={
          <>
            <span>{data?.period.label ?? label}</span>
            <span aria-hidden="true">·</span>
            {data ? <span>Ledger updated {dateTimeOrDash(data.summary.updated_at)}</span> : null}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <a href={`/api/admin/export?type=revenue&${query}`}>
                <Download className="size-3.5" aria-hidden="true" />
                Export
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
              <Link href="/admin/revenue/transactions">
                Fee transactions
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="sm" className="h-9">
              <Link href="/admin/revenue/withdraw">Withdraw revenue</Link>
            </Button>
          </>
        }
      />

      {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}

      {!data && loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <PanelSkeleton lines={2} />
            </div>
          ))}
        </div>
      ) : null}

      {data && components ? (
        <>
          <section aria-label="Revenue headline" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              emphasis
              label="Net revenue in range"
              value={<Money value={components.net} />}
              delta={<Delta changePct={changePct(components.net, data.previousComponents?.net)} noBaseline={!data.previousComponents} label="vs prev." />}
              hint={
                components.paymentsWithTransaction > components.paystackFeesRecordedPayments
                  ? `Provider fee missing on ${count(components.paymentsWithTransaction - components.paystackFeesRecordedPayments)} payments`
                  : 'Provider fees fully recorded'
              }
            />
            <StatTile
              label="Platform available"
              value={<Money value={data.summary.available_balance} />}
              hint="Balance in the platform revenue ledger"
            />
            <StatTile label="Earned all time" value={<Money value={data.summary.total_revenue} />} hint={`${money(data.summary.withdrawn_amount)} withdrawn to date`} />
            <StatTile
              label="Take rate"
              value={percent(components.paymentsVolume > 0 ? (components.serviceFees / components.paymentsVolume) * 100 : null, 2)}
              hint={`${money(components.serviceFees)} on ${money(components.paymentsVolume)} of paid volume`}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Revenue by day"
              description="Service fees from paid orders, by WAT day."
              action={
                <span className="text-[12px] text-muted-foreground">
                  Fees <span className="num font-medium text-foreground">{money(components.serviceFees)}</span>
                </span>
              }
            >
              <RevenueTrendChart data={dailyPoints} />
            </Panel>

            <Panel title="Where revenue comes from" description="Every component of net revenue for this range.">
              <div className="space-y-0">
                <KeyValue label="Service fees" hint={`${count(components.paidOrders)} paid orders`} value={<Money value={components.serviceFees} />} />
                <KeyValue label="Withdrawal fees" hint={`${count(data.withdrawals.successCount)} successful payouts`} value={<Money value={components.withdrawalFees} />} />
                <KeyValue
                  label="Paystack fees"
                  hint={`Recorded on ${count(components.paystackFeesRecordedPayments)} of ${count(components.paymentsWithTransaction)} payments`}
                  value={<Money value={-components.paystackFees} signed />}
                  tone="danger"
                />
                {(components.payoutFees ?? 0) > 0 ? (
                  <KeyValue
                    label="Payout fees"
                    hint={`Paystack, on ${count(components.payoutFeesRecordedWithdrawals ?? 0)} successful payouts`}
                    value={<Money value={-(components.payoutFees ?? 0)} signed />}
                    tone="danger"
                  />
                ) : null}
                <KeyValue label="SMS wallet" hint="Platform top-ups" value={<Money value={-components.smsSpend} signed />} tone="danger" border={false} />
                <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2.5">
                  <span className="text-[13px] font-medium text-foreground">Net revenue</span>
                  <span className="num text-[15px] font-semibold">
                    <Money value={components.net} />
                  </span>
                </div>
              </div>
              {data.previousComponents ? (
                <div className="mt-3 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
                  Previous period: {money(data.previousComponents.net)} net · {money(data.previousComponents.serviceFees)} service fees ·{' '}
                  {money(data.previousComponents.withdrawalFees)} withdrawal fees
                </div>
              ) : null}
            </Panel>
          </div>

          {data.reconciliation ? (
            <Panel
              title="Ledger vs derived"
              description="What the revenue ledger booked, against what the payment data independently explains. Read-only."
              action={
                <span
                  className={
                    data.reconciliation.matches
                      ? 'rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
                      : 'rounded-full border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]'
                  }
                >
                  {data.reconciliation.matches ? 'Reconciled' : 'Needs review'}
                </span>
              }
            >
              <div className="grid gap-x-6 sm:grid-cols-2">
                <div className="min-w-0">
                  <KeyValue
                    label="Ledger total"
                    hint={
                      data.reconciliation.ledgerScope === 'all_time'
                        ? 'Every entry the ledger has booked'
                        : 'Entries booked in this range'
                    }
                    value={<Money value={data.reconciliation.ledgerTotal} />}
                  />
                  <KeyValue
                    label="Derived total"
                    hint="Same scope, from payment data"
                    value={<Money value={data.reconciliation.derivedTotal} />}
                  />
                  <KeyValue
                    label="Unexplained remainder"
                    hint={data.reconciliation.matches ? 'Within ₦1' : 'The ledger and the data disagree'}
                    value={<Money value={data.reconciliation.remainder} signed />}
                    tone={data.reconciliation.matches ? undefined : 'danger'}
                    border={false}
                  />
                </div>
                <div className="min-w-0">
                  <KeyValue label="Service fees" hint="Paid orders" value={<Money value={data.reconciliation.derived.serviceFees} />} />
                  <KeyValue
                    label="Withdrawal fees"
                    hint="Successful payouts"
                    value={<Money value={data.reconciliation.derived.withdrawalFees} />}
                  />
                  <KeyValue
                    label="Payment fees"
                    hint="Paystack, on customer payments"
                    value={<Money value={-data.reconciliation.derived.paymentFees} signed />}
                    tone="danger"
                  />
                  <KeyValue
                    label="Payout fees"
                    hint="Paystack, on money leaving the platform"
                    value={<Money value={-data.reconciliation.derived.payoutFees} signed />}
                    tone="danger"
                    border={false}
                  />
                </div>
              </div>

              {data.reconciliation.ledgerByKind.length > 0 ? (
                <div className="mt-3 rounded-md bg-muted/60 px-2.5 py-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Ledger entries by kind</p>
                  <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {data.reconciliation.ledgerByKind.slice(0, 6).map((entry) => (
                      <li key={entry.kind} className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{entry.kind}</span>{' '}
                        <span className="num text-foreground">{money(entry.amount)}</span>{' '}
                        <span>({count(entry.count)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.reconciliation.available === false ||
              !data.reconciliation.matches ||
              data.reconciliation.uncreditedWithdrawals > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {!data.reconciliation.matches ? (
                    <p className="flex items-start gap-1.5 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2.5 py-2 text-[11px] leading-4 text-[var(--danger)]">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Alerts</span> · {money(Math.abs(data.reconciliation.remainder))} is booked in
                        the ledger but not explained by payment data.
                      </span>
                    </p>
                  ) : null}
                  {data.reconciliation.uncreditedWithdrawals > 0 ? (
                    <p className="flex items-start gap-1.5 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2.5 py-2 text-[11px] leading-4 text-[var(--danger)]">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Alerts</span> · {count(data.reconciliation.uncreditedWithdrawals)} successful
                        payouts still have an uncredited fee worth {money(data.reconciliation.uncreditedFees)}.
                      </span>
                    </p>
                  ) : null}
                  {data.reconciliation.available === false ? (
                    <p className="flex items-start gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-medium">Alerts</span> · the revenue ledger could not be read here, so this card
                        cannot confirm the totals match.
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Panel>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" title="Top businesses by fee revenue" description="Service fees contributed in this range.">
              <RankedBars
                rows={data.topRestaurants.map((business) => ({
                  id: business.id,
                  label: business.name,
                  value: business.restaurant_revenue,
                  secondary: `${count(business.transaction_count)} paid orders`,
                }))}
              />
            </Panel>

            <Panel title="Withdrawals" description="Fees earned from payouts in this range.">
              <div className="space-y-0">
                <KeyValue label="Fee revenue" value={<Money value={data.withdrawals.feeRevenue} />} hint="Successful payouts only" />
                <KeyValue label="Paid out" value={<Money value={data.withdrawals.successAmount} />} hint={`${count(data.withdrawals.successCount)} payouts`} border={false} />
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3 h-8 w-full gap-1.5">
                <Link href="/admin/withdrawals">
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  View withdrawals
                </Link>
              </Button>
            </Panel>
          </div>

          <Panel
            title="Recent fee transactions"
            description="The latest service fees booked on paid orders."
            action={
              <Link href="/admin/revenue/transactions" className="text-[12px] font-medium text-primary hover:underline">
                See all
              </Link>
            }
          >
            {loading && data.recentTransactions.length === 0 ? (
              <TableSkeleton rows={5} columns={5} />
            ) : (
              <DataTable<FeeRow>
                rows={data.recentTransactions}
                columns={feeColumns}
                caption="Recent service fee transactions"
                getRowKey={(row) => row.id}
                getRowHref={(row) => `/admin/revenue/${row.id}`}
                pageSize={8}
                empty={
                  <EmptyState
                    title="No fees booked in this range"
                    description="A service fee is booked when an order is paid. Nothing has been paid in this date range yet."
                  />
                }
                renderMobile={(row) => (
                  <MobileRow
                    href={`/admin/revenue/${row.id}`}
                    title={row.business_name}
                    meta={`Order ${String(row.order_id).slice(0, 12)} · ${dateWat(row.created_at)}`}
                    value={<Money value={row.service_fee_amount} />}
                  />
                )}
              />
            )}
          </Panel>

          <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <p>
              Service fees come from <span className="font-mono">orders.service_fee_amount</span> on paid orders, which is the same
              amount the ledger credits to <span className="font-mono">admin_revenue</span>. Withdrawal fees are counted only for
              payouts that completed, because that is when the fee is credited. Provider fees are shown as “not recorded” rather
              than zero when Paystack did not return a fee for a payment, so net revenue here is a floor, not an estimate.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}

function dateTimeOrDash(value: string | null | undefined): string {
  if (!value) return '—'
  return timeWat(value)
}
