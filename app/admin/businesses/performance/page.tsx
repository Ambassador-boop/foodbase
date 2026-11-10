'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Info, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  EmptyState,
  ErrorState,
  MobileRow,
  Money,
  PageHeader,
  Panel,
  SearchField,
  StatTile,
  StatusPill,
  TableSkeleton,
  type Column,
} from '@/components/admin/ui'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateWat, money, percent } from '@/components/admin/format'
import type { BusinessPerformanceResponse } from '@/components/admin/types'

type BusinessRow = BusinessPerformanceResponse['businesses'][number]

export default function BusinessPerformancePage() {
  const { query, label } = useAdminRange()
  const { data, loading, error, reload } = useAdminData<BusinessPerformanceResponse>(`/api/admin/businesses/summary?${query}`)
  const [search, setSearch] = React.useState('')

  const businesses = React.useMemo(() => data?.businesses ?? [], [data])
  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return businesses
    return businesses.filter((business) => business.name.toLowerCase().includes(term) || (business.slug ?? '').toLowerCase().includes(term))
  }, [businesses, search])

  const totals = React.useMemo(() => {
    return filtered.reduce(
      (accumulator, business) => ({
        volume: accumulator.volume + business.volume,
        paidOrders: accumulator.paidOrders + business.paid_orders,
        serviceFees: accumulator.serviceFees + business.service_fees,
        refunds: accumulator.refunds + business.refunds,
        balance: accumulator.balance + business.balance,
        deficits: accumulator.deficits + (business.deficit ? 1 : 0),
      }),
      { volume: 0, paidOrders: 0, serviceFees: 0, refunds: 0, balance: 0, deficits: 0 },
    )
  }, [filtered])

  const columns: Column<BusinessRow>[] = [
    {
      key: 'name',
      header: 'Business',
      sortValue: (row) => row.name,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.name}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            {row.is_active ? 'Active' : 'Inactive'}
            {row.slug ? ` · /${row.slug}` : ''}
          </span>
        </span>
      ),
    },
    { key: 'paid_orders', header: 'Paid orders', align: 'right', sortValue: (row) => row.paid_orders, render: (row) => <span className="num">{count(row.paid_orders)}</span> },
    {
      key: 'volume',
      header: 'Payments volume',
      align: 'right',
      sortValue: (row) => row.volume,
      render: (row) => <Money value={row.volume} className="font-medium" />,
    },
    { key: 'service_fees', header: 'Service fees', align: 'right', sortValue: (row) => row.service_fees, render: (row) => <Money value={row.service_fees} /> },
    {
      key: 'refund_rate',
      header: 'Refund rate',
      align: 'right',
      sortValue: (row) => row.refund_rate ?? -1,
      render: (row) => (
        <span className="num" title={`${money(row.refunds)} refunded of ${money(row.volume)}`}>
          {row.refund_rate === null ? '—' : percent(row.refund_rate)}
        </span>
      ),
    },
    {
      key: 'withdrawn',
      header: 'Withdrawn',
      align: 'right',
      sortValue: (row) => row.withdrawn,
      render: (row) => <Money value={row.withdrawn} />,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortValue: (row) => row.balance,
      render: (row) => (
        <span className="flex flex-col items-end">
          <Money value={row.balance} className={row.deficit ? 'font-semibold' : 'font-medium'} />
          <span className="text-[11px] font-normal text-muted-foreground">
            {money(row.available_balance)} available
          </span>
        </span>
      ),
    },
    {
      key: 'last_paid_at',
      header: 'Last payment',
      align: 'right',
      sortValue: (row) => row.last_paid_at ?? '',
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.last_paid_at ? dateWat(row.last_paid_at) : 'Never'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Business performance"
        description="Paid volume, fees, refunds and the balance each business is holding. Balances are read live, never recalculated."
        meta={
          <>
            <span>{data?.period.label ?? label}</span>
            <span aria-hidden="true">·</span>
            <span>{count(filtered.length)} businesses</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <a href={`/api/admin/export?type=businesses&${query}`}>
              <Download className="size-3.5" aria-hidden="true" />
              Export CSV
            </a>
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Payments volume" value={<Money value={totals.volume} />} hint={`${count(totals.paidOrders)} paid orders`} />
        <StatTile label="Service fees" value={<Money value={totals.serviceFees} />} hint="Platform revenue from these businesses" />
        <StatTile label="Refunded" value={<Money value={totals.refunds} />} hint="Processed refunds in this range" />
        <StatTile
          label="Held for businesses"
          value={<Money value={totals.balance} />}
          hint={totals.deficits > 0 ? `${count(totals.deficits)} business(es) in deficit` : 'No business is in deficit'}
        />
      </section>

      <Panel
        title="All businesses"
        description="Click a business name to open its full record. Sort any column with the arrow buttons in the header."
        action={<SearchField value={search} onChange={setSearch} placeholder="Search name or slug" label="Search businesses" />}
      >
        {loading && businesses.length === 0 ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <DataTable<BusinessRow>
            rows={filtered}
            columns={columns}
            caption="Business performance for the selected range"
            getRowKey={(row) => row.id}
            initialSortKey="volume"
            pageSize={25}
            empty={
              <EmptyState
                icon={Users}
                title={search ? 'No business matches that search' : 'No businesses yet'}
                description={
                  search
                    ? 'Try a different name or clear the search to see every business again.'
                    : 'Businesses appear here as soon as they are created in the platform.'
                }
                action={
                  search ? (
                    <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            }
            renderMobile={(row) => (
              <MobileRow
                href={`/admin/businesses/${row.id}`}
                title={row.name}
                meta={`${count(row.paid_orders)} paid orders · ${row.last_paid_at ? `last ${dateWat(row.last_paid_at)}` : 'never paid'}`}
                value={<Money value={row.volume} />}
                status={row.deficit ? <StatusPill tone="danger">Deficit</StatusPill> : row.is_active ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="neutral">Inactive</StatusPill>}
              >
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Fees</dt>
                    <dd className="num">{money(row.service_fees)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Refunds</dt>
                    <dd className="num">{row.refund_rate === null ? '—' : percent(row.refund_rate)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Withdrawn</dt>
                    <dd className="num">{money(row.withdrawn)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Balance</dt>
                    <dd className="num">{money(row.balance)}</dd>
                  </div>
                </dl>
              </MobileRow>
            )}
          />
        )}
      </Panel>

      <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <p>
          Refund rate is processed refunds divided by paid volume for the range, so a business with few orders can show a high
          percentage. Withdrawals are counted on the date they completed, not the date they were requested.{' '}
          <Link href="/admin/revenue" className="font-medium text-primary hover:underline">
            See platform revenue
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
