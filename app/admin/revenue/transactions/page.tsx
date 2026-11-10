'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Info, ReceiptText } from 'lucide-react'
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
  StatusBadge,
  StatusPill,
  TableSkeleton,
  type Column,
} from '@/components/admin/ui'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateTimeWat, money } from '@/components/admin/format'
import type { FeeTransactionsResponse } from '@/components/admin/types'

type FeeRow = FeeTransactionsResponse['transactions'][number]

export default function FeeTransactionsPage() {
  const { query, label } = useAdminRange()
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    setPage(1)
  }, [query])

  const { data, loading, error, reload } = useAdminData<FeeTransactionsResponse>(
    `/api/admin/revenue/transactions?${query}&page=${page}&limit=25`,
  )

  const rows = data?.transactions ?? []
  const pagination = data?.pagination
  const pageTotal = rows.reduce((total, row) => total + Number(row.amount ?? 0), 0)

  const columns: Column<FeeRow>[] = [
    {
      key: 'occurred_at',
      header: 'Date',
      sortValue: (row) => row.occurred_at ?? '',
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.occurred_at ? dateTimeWat(row.occurred_at) : '—'}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <StatusPill tone={row.transaction_type === 'withdrawal_fee' ? 'neutral' : 'brand'}>
          {row.transaction_type === 'withdrawal_fee' ? 'Withdrawal fee' : 'Service fee'}
        </StatusPill>
      ),
    },
    {
      key: 'business',
      header: 'Business',
      sortValue: (row) => row.business_name,
      render: (row) => <span className="truncate font-medium">{row.business_name}</span>,
    },
    {
      key: 'order',
      header: 'Order',
      render: (row) =>
        row.order_id ? (
          <Link href={`/admin/transactions/${row.order_id}`} className="font-mono text-[11px] text-primary hover:underline">
            {row.order_id.slice(0, 14)}
          </Link>
        ) : (
          <span className="text-[12px] text-muted-foreground">Withdrawal</span>
        ),
    },
    {
      key: 'amount',
      header: 'Fee',
      align: 'right',
      sortValue: (row) => row.amount,
      render: (row) => <Money value={row.amount} className="font-medium" />,
    },
    {
      key: 'order_status',
      header: 'Order status',
      align: 'right',
      render: (row) => <StatusBadge status={row.order_status} />,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[12px] text-muted-foreground">
          <Link href="/admin/revenue">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Revenue
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Fee transactions"
        description="Every fee the platform has booked, from paid orders and completed withdrawals."
        meta={
          <>
            <span>{data?.period.label ?? label}</span>
            <span aria-hidden="true">·</span>
            <span>{pagination ? `${count(pagination.total)} entries` : 'Loading…'}</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <a href={`/api/admin/export?type=revenue&${query}`}>
              <Download className="size-3.5" aria-hidden="true" />
              Export
            </a>
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      <Panel
        title="Fee ledger"
        description="Service fees are booked only on paid orders. Withdrawal fees are booked only on successful payouts."
        action={
          rows.length > 0 ? (
            <span className="text-[12px] text-muted-foreground">
              This page: <span className="num font-medium text-foreground">{money(pageTotal)}</span>
            </span>
          ) : null
        }
      >
        {loading && rows.length === 0 ? (
          <TableSkeleton rows={8} columns={5} />
        ) : (
          <>
            <DataTable<FeeRow>
              rows={rows}
              columns={columns}
              caption="Service fee and withdrawal fee entries"
              getRowKey={(row) => `${row.transaction_type}:${row.id}`}
              initialSortKey="occurred_at"
              pageSize={25}
              empty={
                <EmptyState
                  icon={ReceiptText}
                  title="No fees in this range"
                  description="Fees appear when an order is paid or a withdrawal completes. Widen the date range to see earlier activity."
                />
              }
              renderMobile={(row) => (
                <MobileRow
                  href={row.order_id ? `/admin/transactions/${row.order_id}` : undefined}
                  title={row.business_name}
                  meta={`${row.transaction_type === 'withdrawal_fee' ? 'Withdrawal fee' : 'Service fee'} · ${row.occurred_at ? dateTimeWat(row.occurred_at) : ''}`}
                  value={<Money value={row.amount} />}
                  status={<StatusBadge status={row.order_status} />}
                />
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
                  unit="entries"
                />
              </div>
            ) : null}
          </>
        )}
      </Panel>

      <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        <p>
          A service fee row can exist before an order is paid; those rows are excluded so this ledger matches the revenue
          figures. Withdrawal fees are written by the settlement flow when a payout succeeds.
        </p>
      </div>
    </div>
  )
}
