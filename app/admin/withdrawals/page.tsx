'use client'

import * as React from 'react'
import Link from 'next/link'
import { Download, Info, Wallet } from 'lucide-react'
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
  StatTile,
  StatusBadge,
  TableSkeleton,
  type Column,
} from '@/components/admin/ui'
import { WithdrawalStatusChart } from '@/components/admin/charts'
import { useAdminRange } from '@/components/admin/range'
import { useAdminData } from '@/components/admin/use-admin-data'
import { count, dateTimeWat, maskAccount, money } from '@/components/admin/format'

interface WithdrawalRow {
  id: string
  business_id: string | null
  business_name: string
  amount: number
  net_amount: number
  withdrawal_fee: number
  bank_account_holder: string | null
  bank_account_number: string | null
  bank_code: string | null
  status: string
  paystack_transfer_id: string | null
  created_at: string | null
  processed_at: string | null
}

interface WithdrawalsResponse {
  period: { label: string }
  summary: {
    byStatus: Array<{ status: string; count: number; amount: number; fee: number }>
    successCount: number
    successAmount: number
    feeRevenue: number
    pendingCount: number
    pendingAmount: number
    failedCount: number
    failedAmount: number
  }
  withdrawals: WithdrawalRow[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'success', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

export default function WithdrawalsPage() {
  const { query, label } = useAdminRange()
  const [page, setPage] = React.useState(1)
  const [status, setStatus] = React.useState('all')
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')

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

  const { data, loading, error, reload } = useAdminData<WithdrawalsResponse>(
    `/api/admin/payouts?${query}&page=${page}&limit=25&status=${status}&search=${encodeURIComponent(search)}`,
  )

  const rows = data?.withdrawals ?? []
  const summary = data?.summary
  const pagination = data?.pagination

  const columns: Column<WithdrawalRow>[] = [
    {
      key: 'business',
      header: 'Business',
      sortValue: (row) => row.business_name,
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{row.business_name}</span>
          <span className="truncate text-[11px] text-muted-foreground">{row.bank_account_holder || 'No account name'}</span>
        </span>
      ),
    },
    { key: 'amount', header: 'Requested', align: 'right', sortValue: (row) => row.amount, render: (row) => <Money value={row.amount} className="font-medium" /> },
    { key: 'fee', header: 'Fee', align: 'right', sortValue: (row) => row.withdrawal_fee, render: (row) => <Money value={row.withdrawal_fee} /> },
    { key: 'net', header: 'Net payout', align: 'right', sortValue: (row) => row.net_amount, render: (row) => <Money value={row.net_amount} /> },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'account',
      header: 'Account',
      align: 'right',
      render: (row) => <span className="font-mono text-[12px] text-muted-foreground">{maskAccount(row.bank_account_number)}</span>,
    },
    {
      key: 'created_at',
      header: 'Requested',
      align: 'right',
      sortValue: (row) => row.created_at ?? '',
      render: (row) => <span className="text-[12px] text-muted-foreground">{row.created_at ? dateTimeWat(row.created_at) : '—'}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Withdrawals"
        description="Payout requests from businesses, their fees and their outcome."
        meta={
          <>
            <span>{data?.period.label ?? label}</span>
            <span aria-hidden="true">·</span>
            <span>{pagination ? `${count(pagination.total)} requests` : 'Loading…'}</span>
          </>
        }
        actions={
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
            <Link href="/admin/revenue">
              <Download className="size-3.5" aria-hidden="true" />
              Revenue
            </Link>
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {summary ? (
        <section aria-label="Withdrawal totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Paid out" value={<Money value={summary.successAmount} />} hint={`${count(summary.successCount)} completed payouts`} />
          <StatTile label="Pending" value={<Money value={summary.pendingAmount} />} hint={`${count(summary.pendingCount)} awaiting completion`} />
          <StatTile label="Fee revenue" value={<Money value={summary.feeRevenue} />} hint="Credited on completed payouts only" />
          <StatTile
            label="Failed attempts"
            value={<Money value={summary.failedAmount} />}
            hint={`${count(summary.failedCount)} attempts · reversed to balances`}
          />
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Requests" description="Newest first. Bank account numbers are masked.">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SearchField value={searchInput} onChange={setSearchInput} placeholder="Business, account or request id" label="Search withdrawals" />
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

          {loading && rows.length === 0 ? (
            <TableSkeleton rows={8} columns={6} />
          ) : (
            <>
              <DataTable<WithdrawalRow>
                rows={rows}
                columns={columns}
                caption="Withdrawal requests"
                getRowKey={(row) => row.id}
                initialSortKey="created_at"
                pageSize={25}
                empty={
                  <EmptyState
                    icon={Wallet}
                    title={search || status !== 'all' ? 'No withdrawals match these filters' : 'No withdrawals in this range'}
                    description={
                      search || status !== 'all'
                        ? 'Try another search, a different status, or a wider date range.'
                        : 'When a business requests a payout, it appears here with its fee and outcome.'
                    }
                  />
                }
                renderMobile={(row) => (
                  <MobileRow
                    title={row.business_name}
                    meta={`${row.created_at ? dateTimeWat(row.created_at) : ''} · ${maskAccount(row.bank_account_number)}`}
                    value={<Money value={row.amount} />}
                    status={<StatusBadge status={row.status} />}
                  >
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border pt-2 text-[12px]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Fee</dt>
                        <dd className="num">{money(row.withdrawal_fee)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Net</dt>
                        <dd className="num">{money(row.net_amount)}</dd>
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
                    unit="requests"
                  />
                </div>
              ) : null}
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="By outcome" description="Counts and value for this range.">
            <WithdrawalStatusChart rows={summary?.byStatus ?? []} />
          </Panel>
          <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <p>
              This page is read-only. Failed timeouts are reversed back to the business balance by the settlement reconciler;
              if one of them stays failed after a deduction, it shows up in{' '}
              <Link href="/admin/attention" className="font-medium text-primary hover:underline">
                alerts
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
