'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Info, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DataTable,
  EmptyState,
  ErrorState,
  MobileRow,
  Money,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  StatusBadge,
  TableSkeleton,
  type Column,
} from '@/components/admin/ui'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateTimeWat, money } from '@/components/admin/format'
import type { TransactionsResponse } from '@/components/admin/types'

type TransactionRow = TransactionsResponse['transactions'][number]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'unsettled', label: 'Not settled' },
  { value: 'failed', label: 'Failed' },
]

export default function TransactionsPage() {
  const { query, label } = useAdminRange()
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  React.useEffect(() => {
    setPage(1)
  }, [query, status])

  const path = `/api/admin/transactions?${query}&page=${page}&limit=25&search=${encodeURIComponent(search)}&status=${status}`
  const { data, loading, error, reload } = useAdminData<TransactionsResponse>(path)

  const rows = data?.transactions ?? []
  const pagination = data?.pagination

  const columns: Column<TransactionRow>[] = [
    {
      key: 'business',
      header: 'Business',
      sortValue: (row) => row.business_name,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.business_name}</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{row.order_id.slice(0, 14)}</span>
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{row.customer_name || '—'}</span>
          <span className="truncate text-[11px] text-muted-foreground">{row.customer_email || ''}</span>
        </span>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', sortValue: (row) => row.total_amount, render: (row) => <Money value={row.total_amount} className="font-medium" /> },
    { key: 'fee', header: 'Service fee', align: 'right', sortValue: (row) => row.service_fee_amount, render: (row) => <Money value={row.service_fee_amount} /> },
    {
      key: 'provider_fee',
      header: 'Provider fee',
      align: 'right',
      sortValue: (row) => (row.provider_fee === null ? -1 : row.provider_fee),
      render: (row) =>
        row.provider_fee === null ? <span className="text-[12px] text-muted-foreground">Not recorded</span> : <Money value={row.provider_fee} />,
    },
    {
      key: 'net',
      header: 'Net to business',
      align: 'right',
      sortValue: (row) => row.net_received,
      render: (row) => <Money value={row.net_received} />,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (row) => (
        <span className="flex flex-col items-end gap-1">
          <StatusBadge status={row.payment_status} />
          {row.refunded > 0 ? <span className="text-[11px] text-[var(--danger)]">Refunded {money(row.refunded)}</span> : null}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Paid',
      align: 'right',
      sortValue: (row) => row.created_at ?? '',
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.created_at ? dateTimeWat(row.created_at) : '—'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Transactions"
        description="Every paid order with its fee, provider cost and settlement state."
        meta={
          <>
            <span>{data?.period.label ?? label}</span>
            <span aria-hidden="true">·</span>
            <span>{pagination ? `${count(pagination.total)} paid orders` : 'Loading…'}</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <a href={`/api/admin/export?type=transactions&${query}`}>
              <Download className="size-3.5" aria-hidden="true" />
              Export payments
            </a>
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <Panel
        title="Payments"
        description="Only orders that are actually paid appear here. Unpaid orders are counted in the funnel on the overview."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <SearchField value={searchInput} onChange={setSearchInput} placeholder="Business, customer, order or reference" label="Search transactions" />
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="sr-only">Filter by status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-9 min-h-9 rounded-md border border-input bg-card px-2 text-[12px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={8} columns={6} />
        ) : (
          <>
            <DataTable<TransactionRow>
              rows={rows}
              columns={columns}
              caption="Paid orders with fees and settlement state"
              getRowKey={(row) => row.id}
              getRowHref={(row) => `/admin/transactions/${row.order_id}`}
              initialSortKey="created_at"
              pageSize={25}
              empty={
                <EmptyState
                  icon={ReceiptText}
                  title={search || status !== 'all' ? 'No payments match these filters' : 'No paid orders in this range'}
                  description={
                    search || status !== 'all'
                      ? 'Try a different search term, clear the status filter, or widen the date range.'
                      : 'When a customer completes checkout, the order appears here with its fee and settlement state.'
                  }
                  action={
                    search || status !== 'all' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchInput('')
                          setStatus('all')
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              }
              renderMobile={(row) => (
                <MobileRow
                  href={`/admin/transactions/${row.order_id}`}
                  title={row.business_name}
                  meta={`${row.customer_name || 'Customer'} · ${row.created_at ? dateTimeWat(row.created_at) : ''}`}
                  value={<Money value={row.total_amount} />}
                  status={<StatusBadge status={row.payment_status} />}
                >
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-[12px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Service fee</dt>
                      <dd className="num">{money(row.service_fee_amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Provider</dt>
                      <dd className="num">{row.provider_fee === null ? 'Not recorded' : money(row.provider_fee)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Net</dt>
                      <dd className="num">{money(row.net_received)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">Refunded</dt>
                      <dd className="num">{row.refunded > 0 ? money(row.refunded) : '—'}</dd>
                    </div>
                  </dl>
                </MobileRow>
              )}
            />

            {pagination && pagination.total > 0 ? (
              <div className="mt-3">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  total={pagination.total}
                  pageSize={pagination.limit}
                  onChange={setPage}
                  unit="payments"
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <p>
          Totals for the whole range live on the{' '}
          <Link href="/admin" className="font-medium text-primary hover:underline">
            overview
          </Link>
          . This list only includes orders with a paid payment status, so it always agrees with the revenue figures.
        </p>
      </div>
    </div>
  )
}
