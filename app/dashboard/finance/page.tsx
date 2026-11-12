'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, Undo2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ActivityRow,
  DayGroup,
  FeedSearch,
  FeedTabs,
  FinanceHero,
  NGN,
  PendingSettlementCard,
  StatCard,
} from '@/components/finance'
import type { ActivityKind, PendingGroup } from '@/components/finance'
import { useFinanceFeed } from '@/components/finance/use-finance-feed'
import { formatNaira } from '@/lib/finance'
import { formatWat, formatWatYMD } from '@/lib/wat'

const TABS = ['all', 'income', 'withdrawals', 'refunds', 'settlements'] as const
type Tab = (typeof TABS)[number]

const PAGE_SIZE = 30

interface FeedEntry {
  kind: ActivityKind
  status: string
  amount: number
  title: string
  subtitle: React.ReactNode
  meta?: string
  href: string
  created_at: string
}

/** Settlement times read better as "Thu, 13 Nov 5:00 AM WAT". */
function settlementDayLabel(value: string | null | undefined) {
  if (!value) return 'soon'
  return formatWat(value, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).replace(/\b(am|pm)\b/g, (match) => match.toUpperCase())
}

function dayLabel(day: string) {
  const today = formatWatYMD(new Date())
  const yesterday = formatWatYMD(new Date(Date.now() - 86_400_000))
  if (day === today) return 'Today'
  if (day === yesterday) return 'Yesterday'
  return formatWat(new Date(`${day}T12:00:00`), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function FinancePage() {
  const {
    business,
    transactions,
    withdrawals,
    refunds,
    settlements,
    pending,
    pendingTotals,
    loading,
    error,
    fast,
  } = useFinanceFeed()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const feed = useMemo<FeedEntry[]>(() => {
    const income = transactions.map((transaction: any) => ({
      kind: 'income' as ActivityKind,
      status: String(transaction.status ?? ''),
      amount: Number(transaction.amount || 0),
      title: 'Order payment',
      subtitle:
        transaction.customer_name || `Order ${String(transaction.order_id).slice(0, 8)}`,
      meta:
        String(transaction.payment_method || '').toLowerCase() === 'paystack'
          ? 'Online payment'
          : transaction.payment_method || 'Online payment',
      href: `/dashboard/finance/transaction/${transaction.order_id}`,
      created_at: transaction.created_at,
    }))

    const payouts = withdrawals.map((withdrawal: any) => ({
      kind: 'withdrawal' as ActivityKind,
      status: String(withdrawal.status ?? ''),
      amount: -Number(withdrawal.amount || 0),
      title: 'Withdrawal',
      subtitle: (
        <>
          <span className="block">{`${withdrawal.bank_name || withdrawal.bank_code || 'Bank'} •••• ${String(withdrawal.bank_account_number || '').slice(-4)}`}</span>
          <span className="block">{withdrawal.bank_account_holder || 'Account holder'}</span>
        </>
      ),
      meta:
        Number(withdrawal.withdrawal_fee) > 0
          ? `includes ${formatNaira(withdrawal.withdrawal_fee)} fee`
          : undefined,
      href: `/dashboard/finance/withdrawal/${withdrawal.id}`,
      created_at: withdrawal.created_at,
    }))

    const refunded = refunds.map((refund: any) => ({
      kind: 'refund' as ActivityKind,
      status: String(refund.status ?? ''),
      amount: -Number(refund.amount || 0),
      title: 'Refund',
      subtitle: refund.customer_name || `Order ${String(refund.order_id).slice(0, 8)}`,
      href: `/dashboard/finance/refunds/${refund.id}`,
      created_at: refund.created_at,
    }))

    const settled = settlements.map((settlement: any) => ({
      kind: 'settlement' as ActivityKind,
      status: 'settled',
      amount: Number(settlement.total_amount || 0),
      title: 'Settlement',
      subtitle: `${settlement.transaction_count} ${
        Number(settlement.transaction_count) === 1 ? 'order' : 'orders'
      } moved to available`,
      href: `/dashboard/finance/settlement/${String(settlement.settlement_date).slice(0, 10)}`,
      created_at: settlement.last_settlement_time,
    }))

    return [...income, ...payouts, ...refunded, ...settled]
      .filter((entry) => entry.created_at)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }, [transactions, withdrawals, refunds, settlements])

  const filtered = useMemo(
    () =>
      feed
        .filter((entry) => tab === 'all' || entry.kind === tab)
        .filter((entry) =>
          `${entry.title} ${typeof entry.subtitle === 'string' ? entry.subtitle : ''}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
    [feed, tab, search],
  )

  const groups = useMemo(() => {
    const byDay = new Map<string, FeedEntry[]>()
    for (const entry of filtered.slice(0, visible)) {
      const day = formatWatYMD(entry.created_at)
      byDay.set(day, [...(byDay.get(day) ?? []), entry])
    }
    return Array.from(byDay.entries())
  }, [filtered, visible])

  const pendingGroups = useMemo<PendingGroup[]>(() => {
    const bySettlementDay = new Map<string, PendingGroup>()
    for (const order of pending) {
      const label = settlementDayLabel(order.available_at)
      const group = bySettlementDay.get(label) ?? {
        label,
        gross: 0,
        refunded: 0,
        refundedInProgress: 0,
        net: 0,
        count: 0,
        orders: [],
      }
      group.gross = Number(group.gross || 0) + Number(order.amount || 0)
      // Include refunds still in flight: they are held out of this settlement.
      group.refunded =
        Number(group.refunded || 0) +
        Number(order.refunded_processed || 0) +
        Number(order.refunded_in_progress || 0)
      group.refundedInProgress =
        Number(group.refundedInProgress || 0) + Number(order.refunded_in_progress || 0)
      group.net = Number(group.net || 0) + Number(order.net_settling || 0)
      group.count = Number(group.count || 0) + 1
      group.orders = [...(group.orders ?? []), order]
      bySettlementDay.set(label, group)
    }
    return Array.from(bySettlementDay.values())
  }, [pending])

  const inflow = transactions
    .filter((transaction: any) => transaction.status === 'completed')
    .reduce((sum: number, transaction: any) => sum + Number(transaction.amount || 0), 0)
  const withdrawn = withdrawals
    .filter((withdrawal: any) => !['failed', 'rejected'].includes(withdrawal.status))
    .reduce((sum: number, withdrawal: any) => sum + Number(withdrawal.amount || 0), 0)
  const refundedTotal = refunds
    .filter((refund: any) => !['failed', 'rejected'].includes(refund.status))
    .reduce((sum: number, refund: any) => sum + Number(refund.amount || 0), 0)

  const availableBalance = Number(business?.available_balance || 0)
  const ledgerPending = Number(business?.pending_balance || 0)
  // The hero shows what will actually settle: every pending payment minus the
  // refunds already requested against it.
  const pendingNet = pendingTotals ? Number(pendingTotals.net_settling || 0) : ledgerPending
  const pendingGap = Math.round((pendingNet - ledgerPending) * 100) / 100
  const nextSettlement = pendingTotals?.next_available_at
    ? settlementDayLabel(pendingTotals.next_available_at)
    : null

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 md:space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Finance</p>
          <h1 className="text-2xl font-semibold tracking-tight">Money movement</h1>
        </div>
        {fast && (
          <p className="text-[11px] text-muted-foreground" role="status">
            Updating every 8 seconds while your withdrawal is in progress
          </p>
        )}
      </header>

      {loading && !business ? (
        <FinancePageSkeleton />
      ) : (
        <>
          <FinanceHero
            available={availableBalance}
            pending={pendingNet}
            pendingOrders={pendingTotals?.orders ?? pending.length}
            pendingRefunded={Number(pendingTotals?.refunded || 0)}
            nextSettlement={nextSettlement}
            pendingNote={
              Math.abs(pendingGap) >= 0.01
                ? `Balance record differs by ${formatNaira(Math.abs(pendingGap))} from itemised settlements`
                : null
            }
            onWithdraw={() => location.assign('/dashboard/finance/withdraw')}
          />

          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label="Total inflow"
              value={<span className="num">{formatNaira(inflow)}</span>}
              icon={ArrowDownToLine}
            />
            <StatCard
              label="Withdrawn"
              value={<span className="num">{formatNaira(withdrawn)}</span>}
              icon={ArrowUpRight}
            />
            <StatCard
              label="Refunded"
              value={<span className="num">{formatNaira(refundedTotal)}</span>}
              icon={Undo2}
            />
          </div>

          <PendingSettlementCard groups={pendingGroups} />

          <Card className="gap-0 p-3 md:p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <FeedTabs
                tabs={TABS}
                value={tab}
                onChange={(next) => {
                  setTab(next as Tab)
                  setVisible(PAGE_SIZE)
                }}
              />
              <FeedSearch value={search} onChange={setSearch} />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
                {error}
              </p>
            )}

            <div className="mt-3 space-y-5">
              {groups.map(([day, entries]) => (
                <DayGroup key={day} label={dayLabel(day)}>
                  <div>
                    {entries.map((entry, index) => (
                      <ActivityRow
                        key={`${day}-${entry.kind}-${index}`}
                        {...entry}
                        amount={
                          entry.kind === 'income' ? (
                            <>{entry.amount > 0 ? '+' : ''}{NGN(entry.amount)}</>
                          ) : entry.kind === 'settlement' ? (
                            NGN(entry.amount)
                          ) : (
                            <>{entry.amount < 0 ? '−' : ''}{NGN(Math.abs(entry.amount))}</>
                          )
                        }
                      />
                    ))}
                  </div>
                </DayGroup>
              ))}

              {!loading && groups.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-sm font-medium">Nothing here yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {search
                      ? 'No activity matches that search.'
                      : 'Payments, refunds and settlements will appear here.'}
                  </p>
                </div>
              )}
            </div>

            {visible < filtered.length && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
              >
                Load more
              </Button>
            )}
          </Card>
        </>
      )}
    </main>
  )
}

function FinancePageSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
