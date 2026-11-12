'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, ArrowUpRight, Bell, CheckCircle2, Download, Info, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PageHeader, Panel, StatTile, Delta, Money, StatusPill, ErrorState, PanelSkeleton, KeyValue } from '@/components/admin/ui'
import { RevenueTrendChart, VolumeTrendChart, FunnelBreakdown, WithdrawalStatusChart, RankedBars } from '@/components/admin/charts'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { SmsLowBalanceBanner } from '@/components/admin/sms-funding'
import { count, dateTimeWat, money, percent, timeWat } from '@/components/admin/format'
import type { OverviewResponse } from '@/components/admin/types'

function changePct(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined) return null
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / Math.abs(previous)) * 100
}

export default function AdminOverviewPage() {
  const { query, label } = useAdminRange()
  const { data, loading, error, reload } = useAdminData<OverviewResponse>(`/api/admin/overview?${query}`)

  const overview = data?.overview
  const period = data?.period

  const exportOptions = [
    { label: 'Businesses (CSV)', href: `/api/admin/export?type=businesses&${query}` },
    { label: 'Payments (CSV)', href: `/api/admin/export?type=transactions&${query}` },
    { label: 'Revenue by day (CSV)', href: `/api/admin/export?type=revenue&${query}` },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Platform overview"
        description="Revenue, payments and the money position across every business on FoodBase."
        meta={
          <>
            <span>{period?.label ?? label}</span>
            <span aria-hidden="true">·</span>
            <span>West Africa Time</span>
            <span aria-hidden="true">·</span>
            <span>All amounts in naira</span>
            {data ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Updated {timeWat(data.generatedAt)}</span>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <Download className="size-3.5" aria-hidden="true" />
                  Export
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[220px] p-1">
                {exportOptions.map((option) => (
                  <a
                    key={option.label}
                    href={option.href}
                    className="flex min-h-9 items-center rounded-md px-2 text-[13px] hover:bg-muted"
                  >
                    {option.label}
                  </a>
                ))}
                <p className="px-2 pt-1 pb-1.5 text-[11px] text-muted-foreground">Exports use the selected date range.</p>
              </PopoverContent>
            </Popover>
            <Button asChild size="sm" className="h-9 gap-1.5">
              <Link href="/admin/attention">
                <Bell className="size-3.5" aria-hidden="true" />
                Alerts
                {overview && overview.attention > 0 ? (
                  <span className="num rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-semibold">{overview.attention}</span>
                ) : null}
              </Link>
            </Button>
          </>
        }
      />

      <SmsLowBalanceBanner />

      {error && !data ? <ErrorState message={error} onRetry={reload} /> : null}

      {!data && loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading platform overview">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <PanelSkeleton lines={2} />
            </div>
          ))}
        </div>
      ) : null}

      {!data && !loading && !error ? (
        <Panel title="No data yet">
          <p className="text-[13px] text-muted-foreground">The overview appears once the platform has at least one order.</p>
        </Panel>
      ) : null}

      {overview && data ? (
        <>
          <section aria-label="Headline figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              emphasis
              label="Net revenue"
              value={<Money value={overview.revenue.net} />}
              delta={
                <Delta
                  changePct={changePct(overview.revenue.net, overview.revenueComparison?.net)}
                  noBaseline={!overview.revenueComparison}
                  label="vs prev."
                />
              }
              hint={
                overview.revenue.incomplete ? (
                  <span className="flex items-center gap-1 text-[var(--warning)]">
                    <Info className="size-3" aria-hidden="true" />
                    Paystack fee missing on {count(overview.revenue.paystackFeesMissing)} payments
                  </span>
                ) : (
                  'Service fees + withdrawal fees − provider costs'
                )
              }
            />
            <StatTile
              label="Payments volume"
              value={<Money value={overview.paymentsVolume} />}
              delta={
                <Delta
                  changePct={changePct(overview.paymentsVolume, overview.paymentsVolumePrevious)}
                  noBaseline={overview.paymentsVolumePrevious === null}
                  label="vs prev."
                />
              }
              hint={`${count(overview.paidOrders)} paid orders · avg ${money(overview.averageOrder)}`}
            />
            <StatTile
              label="Owed to businesses"
              value={<Money value={overview.owedToBusinesses} />}
              hint={`${money(overview.businessBalances.availableTotal)} available · ${money(overview.businessBalances.pendingTotal)} awaiting settlement`}
            />
            <StatTile
              label="Platform available"
              value={<Money value={overview.availableRevenue} />}
              hint={`${money(overview.platformRevenue.totalRevenue)} earned all time · ${money(overview.platformRevenue.withdrawnAmount)} withdrawn`}
            />
          </section>

          <section aria-label="Operations" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Paid orders"
              value={count(overview.paidOrders)}
              delta={
                <Delta
                  changePct={changePct(overview.paidOrders, overview.paidOrdersPrevious)}
                  noBaseline={overview.paidOrdersPrevious === null}
                  label="vs prev."
                />
              }
              hint={`${percent(overview.funnel.conversionRate)} of orders convert`}
            />
            <StatTile
              label="Average order"
              value={<Money value={overview.averageOrder} />}
              delta={
                <Delta
                  changePct={changePct(overview.averageOrder, overview.averageOrderPrevious)}
                  noBaseline={overview.averageOrderPrevious === null}
                  label="vs prev."
                />
              }
              hint={`Across ${count(overview.activeBusinesses)} active businesses`}
            />
            <StatTile
              label="Refunds"
              value={<Money value={overview.refunds.amount} />}
              hint={
                overview.refunds.count === 0
                  ? 'No refunds processed in this range'
                  : `${count(overview.refunds.count)} processed · ${percent(overview.refunds.rate)} of volume`
              }
            />
            <StatTile
              label="Withdrawals paid out"
              value={<Money value={overview.withdrawals.successAmount} />}
              hint={`${count(overview.withdrawals.successCount)} completed · ${count(overview.withdrawals.pendingCount)} pending`}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Net revenue"
              description="Service fees plus withdrawal fees, minus recorded provider fees, per WAT day."
              action={
                <span className="text-[12px] text-muted-foreground">
                  Total <span className="num font-medium text-foreground">{money(overview.revenue.net)}</span>
                </span>
              }
            >
              <RevenueTrendChart data={overview.daily} />
            </Panel>
            <Panel title="Order funnel" description="What happened to the orders created in this range.">
              <FunnelBreakdown funnel={overview.funnel} />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel
              className="xl:col-span-2"
              title="Payments volume"
              description="Value of paid orders per WAT day."
              action={
                <span className="text-[12px] text-muted-foreground">
                  Peak day <span className="num font-medium text-foreground">{money(Math.max(0, ...overview.daily.map((day) => day.volume)))}</span>
                </span>
              }
            >
              <VolumeTrendChart data={overview.daily} />
            </Panel>
            <Panel
              title="Top businesses"
              description="By paid volume in this range."
              action={
                <Link href="/admin/businesses/performance" className="text-[12px] font-medium text-primary hover:underline">
                  All businesses
                </Link>
              }
            >
              <RankedBars
                rows={overview.topBusinesses.map((business) => ({
                  id: business.id,
                  label: business.name,
                  value: business.volume,
                  secondary: `${count(business.paidOrders)} paid orders · ${money(business.serviceFees)} fees`,
                }))}
              />
            </Panel>
          </div>

          <section aria-label="Money position" className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-[14px] font-semibold text-foreground">Money position</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Can the platform cover every business balance right now? Read-only check of the live Paystack balance.
                </p>
              </div>
              {overview.solvency.covered === null ? (
                <StatusPill tone="warning">Cannot verify</StatusPill>
              ) : overview.solvency.covered ? (
                <StatusPill tone="success">Covered</StatusPill>
              ) : (
                <StatusPill tone="danger">Shortfall</StatusPill>
              )}
            </div>

            <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
              <div className="px-4 py-4 sm:px-5">
                <p className="text-[12px] text-muted-foreground">In Paystack</p>
                <p className="num mt-1 text-[20px] font-semibold text-foreground">
                  {overview.solvency.paystackBalance === null ? 'Unavailable' : money(overview.solvency.paystackBalance)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {overview.solvency.paystackBalance === null
                    ? overview.solvency.paystackBalanceError
                    : `Read ${dateTimeWat(overview.solvency.paystackBalanceAsOf)}${overview.solvency.paystackBalanceStale ? ' · cached' : ''}`}
                </p>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <p className="text-[12px] text-muted-foreground">Owed to businesses</p>
                <p className="num mt-1 text-[20px] font-semibold text-foreground">{money(overview.solvency.owedToBusinesses)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {overview.solvency.totalDeficits > 0
                    ? `${money(overview.solvency.totalDeficits)} of deficits across ${count(overview.solvency.deficitCount)} businesses`
                    : 'No negative balances'}
                </p>
              </div>
              <div className="px-4 py-4 sm:px-5">
                <p className="text-[12px] text-muted-foreground">Platform revenue available</p>
                <p className="num mt-1 text-[20px] font-semibold text-foreground">{money(overview.solvency.adminAvailableRevenue)}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">From the platform revenue ledger</p>
              </div>
            </div>

            <div className="border-t border-border px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {overview.solvency.difference === null ? (
                    <ShieldAlert className="size-4 text-[var(--warning)]" aria-hidden="true" />
                  ) : overview.solvency.difference >= 0 ? (
                    <CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="size-4 text-[var(--danger)]" aria-hidden="true" />
                  )}
                  <p className="text-[13px] text-foreground">
                    Difference after paying every business and moving platform revenue
                  </p>
                </div>
                <p className="num text-[15px] font-semibold">
                  {overview.solvency.difference === null ? (
                    <span className="text-muted-foreground">Unknown</span>
                  ) : (
                    <Money value={overview.solvency.difference} signed />
                  )}
                </p>
              </div>
              {overview.solvency.deficits.length > 0 ? (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                  {overview.solvency.deficits.map((deficit) => (
                    <li key={deficit.id}>
                      <Link href={`/admin/businesses/${deficit.id}`} className="underline-offset-2 hover:text-foreground hover:underline">
                        {deficit.name}
                      </Link>{' '}
                      <span className="num text-[var(--danger)]">{money(deficit.balance)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="Needs attention"
              description="Items that need a person to look at them."
              action={
                <Link href="/admin/attention" className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                  Open queue
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              }
            >
              {overview.attention === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-[13px] text-muted-foreground">
                  <CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden="true" />
                  Nothing needs attention right now.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {[
                    { label: 'Failed withdrawals awaiting reversal', value: overview.attentionCounts.stuckWithdrawals },
                    { label: 'Paid orders without a payment record', value: overview.attentionCounts.paidWithoutTransaction },
                    { label: 'Balance anomalies', value: overview.attentionCounts.anomalies },
                    { label: 'Stuck refunds', value: overview.attentionCounts.stuckRefunds },
                    { label: 'Unsettled platform transfers', value: overview.attentionCounts.pendingTransfers },
                  ].map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-[13px] text-muted-foreground">{row.label}</span>
                      <span className={`num text-[13px] font-semibold ${row.value > 0 ? 'text-[var(--danger)]' : 'text-muted-foreground'}`}>
                        {count(row.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Revenue composition" description="How platform revenue was earned in this range.">
              <div className="space-y-0">
                <KeyValue label="Service fees" hint="From paid orders" value={<Money value={overview.revenue.serviceFees} />} />
                <KeyValue label="Withdrawal fees" hint="Successful payouts only" value={<Money value={overview.revenue.withdrawalFees} />} />
                <KeyValue
                  label="Paystack fees"
                  hint={
                    overview.revenue.incomplete
                      ? `Recorded on ${count(overview.revenue.paystackFeesRecordedPayments)} of ${count(overview.revenue.paymentsWithTransaction)} payments`
                      : `Across ${count(overview.revenue.paymentsWithTransaction)} payments`
                  }
                  value={<Money value={-overview.revenue.paystackFees} signed />}
                  tone="danger"
                />
                <KeyValue
                  label="SMS wallet"
                  hint="Top-ups that left the platform balance"
                  value={<Money value={-overview.revenue.smsSpend} signed />}
                  tone="danger"
                  border={false}
                />
                <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2.5">
                  <span className="text-[13px] font-medium text-foreground">Net revenue</span>
                  <span className="num text-[15px] font-semibold text-foreground">
                    <Money value={overview.revenue.net} />
                  </span>
                </div>
                {overview.revenue.incomplete ? (
                  <p className="mt-2 rounded-md bg-[var(--warning-bg)] px-2 py-1.5 text-[11px] leading-4 text-[var(--warning)]">
                    Paystack fee is not recorded on every payment, so this is a floor. Net revenue may be higher once fees are
                    captured.
                  </p>
                ) : null}
              </div>
            </Panel>

            <Panel title="Settlement pipeline" description="When business balances become withdrawable.">
              <div className="space-y-0">
                <KeyValue label="Awaiting settlement" value={<Money value={overview.settlement.pendingAmount} />} hint={`${count(overview.settlement.pendingCount)} transactions`} />
                <KeyValue label="Settled in this range" value={<Money value={overview.settlement.settledAmount} />} hint={`${count(overview.settlement.settledCount)} transactions`} />
                <KeyValue
                  label="Next scheduled run"
                  value={overview.settlement.nextRunAt ? `${dateTimeWat(overview.settlement.nextRunAt)}` : '—'}
                  hint="Scheduled daily at 05:00 WAT"
                  border={false}
                />
              </div>
              <div className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
                Balances move automatically. Nothing on this page writes to the ledger.
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Withdrawals" description="Payout requests created in this range.">
              <WithdrawalStatusChart rows={overview.withdrawals.byStatus} />
              <div className="mt-3 space-y-1 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>Fees earned</span>
                  <span className="num font-medium text-foreground">{money(overview.withdrawals.feeRevenue)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Pending amount</span>
                  <span className="num font-medium text-foreground">{money(overview.withdrawals.pendingAmount)}</span>
                </div>
                <p className="pt-1 text-[11px] leading-4">
                  Failed attempts are not losses. A failed payout is reversed back to the business balance by the settlement
                  reconciler.
                </p>
              </div>
            </Panel>

            <Panel title="Refunds" description="Refunds processed in this range.">
              {overview.refunds.count === 0 && overview.refunds.pendingCount === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-6 text-[13px] text-muted-foreground">
                  <CheckCircle2 className="size-4 text-[var(--success)]" aria-hidden="true" />
                  No refunds in this range.
                </div>
              ) : (
                <div className="space-y-0">
                  <KeyValue label="Processed" value={<Money value={overview.refunds.amount} />} hint={`${count(overview.refunds.count)} refunds`} />
                  <KeyValue label="Share of volume" value={percent(overview.refunds.rate)} hint="Refunded amount ÷ payments volume" />
                  <KeyValue label="Pending" value={<Money value={overview.refunds.pendingAmount} />} hint={`${count(overview.refunds.pendingCount)} awaiting completion`} />
                  <KeyValue
                    label="Failed attempts"
                    value={<Money value={overview.refunds.failedAmount} />}
                    hint={`${count(overview.refunds.failedCount)} attempts · no money moved`}
                    border={false}
                  />
                </div>
              )}
            </Panel>

            <Panel title="Businesses" description="Directory health for this range.">
              <div className="space-y-0">
                <KeyValue label="Active" value={count(overview.activeBusinesses)} hint={`${count(overview.totalBusinesses)} total`} />
                <KeyValue label="New in this range" value={count(overview.newBusinesses)} hint="Created since the range started" />
                <KeyValue
                  label="Take rate"
                  value={percent(overview.paymentsVolume > 0 ? (overview.revenue.serviceFees / overview.paymentsVolume) * 100 : null)}
                  hint="Service fees ÷ payments volume"
                />
                <KeyValue label="In deficit" value={count(overview.solvency.deficitCount)} hint="Negative balance" tone={overview.solvency.deficitCount > 0 ? 'danger' : 'default'} border={false} />
              </div>
              <Button asChild variant="outline" size="sm" className="mt-3 h-8 w-full gap-1.5">
                <Link href="/admin/businesses/performance">
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  Business performance
                </Link>
              </Button>
            </Panel>
          </div>

          <div className="rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">
            <p className="flex items-start gap-1.5">
              <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-medium text-foreground">How these numbers are built.</strong> A payment counts when the
                order&apos;s payment status is <span className="font-mono">paid</span> or <span className="font-mono">completed</span>,
                which is the condition the settlement function writes. Revenue is service fees on paid orders plus fees from
                successful withdrawals, minus recorded provider fees and SMS wallet top-ups. Days start and end at midnight West
                Africa Time. Percent changes compare with the equally long period immediately before this range.
              </span>
            </p>
          </div>
        </>
      ) : null}

      {data && loading ? (
        <p className="text-[12px] text-muted-foreground" role="status">
          Updating for {label}…
        </p>
      ) : null}
    </div>
  )
}
