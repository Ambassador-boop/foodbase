'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, RefreshCw, Store } from 'lucide-react'
import {
  DashSurface,
  DataTable,
  type Column,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  StatTile,
  StatusPill,
  ConfirmDialog,
  toast,
  dateTime,
  relativeTime,
  formatNigerianPhone,
  SearchInput,
  FilterTabs,
} from '@/components/dashboard'

/**
 * New registrations.
 *
 * Every restaurant that self-registered, newest first, with the two things an
 * operator needs to act on: is the email confirmed, and is the account live.
 * Suspend/Reactivate uses the existing is_active column. There is no approval
 * step anywhere in this screen.
 */

type Registration = {
  id: string
  name: string | null
  slug: string | null
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  created_at: string
  is_active: boolean | null
  logo_url: string | null
  owner_id: string | null
  first_name: string | null
  last_name: string | null
  owner_phone: string | null
  email_verified: boolean | null
}

export default function NewRegistrationsPage() {
  const [rows, setRows] = React.useState<Registration[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [filter, setFilter] = React.useState<'all' | 'active' | 'suspended'>('all')
  const [target, setTarget] = React.useState<Registration | null>(null)
  const [saving, setSaving] = React.useState(false)

  // Debounce the search so a keystroke does not hit the API.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const load = React.useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100', filter })
      if (query) params.set('search', query)
      const response = await fetch(`/api/admin/businesses/registrations?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed')
      setRows(Array.isArray(data.registrations) ? data.registrations : [])
    } catch {
      setError('The registration list did not load. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [filter, query])

  React.useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const changeStatus = async (row: Registration, isActive: boolean) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/businesses/${row.id}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error('Could not change the status', {
          description: typeof data?.error === 'string' ? data.error : 'Try again in a moment.',
        })
        return
      }
      setRows((current) => current.map((entry) => (entry.id === row.id ? { ...entry, is_active: isActive } : entry)))
      toast.success(isActive ? 'Restaurant reactivated' : 'Restaurant suspended', {
        description: isActive
          ? 'The storefront and ordering are available again.'
          : 'The storefront is closed to customers. Data and payouts are untouched.',
      })
      setTarget(null)
    } catch {
      toast.error('Could not change the status', { description: 'Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  const verifiedCount = rows.filter((row) => row.email_verified === true).length
  const unverifiedCount = rows.filter((row) => row.email_verified === false).length
  const suspendedCount = rows.filter((row) => row.is_active === false).length

  const columns: Array<Column<Registration>> = [
    {
      key: 'name',
      header: 'Restaurant',
      sortValue: (row) => row.name ?? '',
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate font-medium text-[var(--dash-ink-1)]">{row.name ?? 'Unnamed'}</span>
          <span className="block truncate text-[11.5px] text-[var(--dash-ink-4)]">
            {row.slug ? `foodbase.ng/${row.slug}` : 'No storefront address'}
          </span>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (row) => `${row.first_name ?? ''} ${row.last_name ?? ''}`,
      render: (row) => (
        <div className="min-w-0">
          <span className="block truncate text-[var(--dash-ink-1)]">
            {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
          </span>
          <span className="block truncate text-[11.5px] text-[var(--dash-ink-3)]">{row.email ?? '—'}</span>
          <span className="mt-1 block">
            <StatusPill tone={row.email_verified === true ? 'success' : row.email_verified === false ? 'neutral' : 'neutral'}>
              {row.email_verified === true ? 'Email verified' : row.email_verified === false ? 'Email unverified' : 'Verification unknown'}
            </StatusPill>
          </span>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'lg',
      numeric: true,
      render: (row) => (
        <span className="whitespace-nowrap">{formatNigerianPhone(row.owner_phone ?? row.phone)}</span>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      hideBelow: 'sm',
      sortValue: (row) => row.state ?? '',
      render: (row) => (
        <span className="truncate">
          {[row.city, row.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Registered',
      sortValue: (row) => new Date(row.created_at).getTime(),
      render: (row) => (
        <span className="whitespace-nowrap" title={dateTime(row.created_at)}>
          {relativeTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      sortValue: (row) => (row.is_active ? 1 : 0),
      render: (row) => (
        <StatusPill tone={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Active' : 'Suspended'}</StatusPill>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={`/admin/businesses/${row.id}`}
            className="dash-tap inline-flex h-8 items-center gap-1 rounded-[6px] border border-[var(--dash-line-strong)] px-2 text-[11.5px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
            aria-label={`Open ${row.name ?? 'restaurant'}`}
          >
            Open
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => setTarget(row)}
            className={`dash-tap inline-flex h-8 items-center rounded-[6px] border px-2 text-[11.5px] font-medium ${
              row.is_active
                ? 'border-[var(--dash-danger)]/30 text-[var(--dash-danger)] hover:bg-[var(--dash-danger-bg)]'
                : 'border-[var(--dash-success)]/30 text-[var(--dash-success)] hover:bg-[var(--dash-success-bg)]'
            }`}
          >
            {row.is_active ? 'Suspend' : 'Reactivate'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <DashSurface>
      <PageHeader
        eyebrow="Businesses"
        title="New registrations"
        description="Restaurants that registered themselves. Accounts are active immediately, so this is a review list, not an approval queue. Suspending uses the same is_active flag the rest of the platform reads."
        meta={
          <>
            <span>{rows.length} shown</span>
            <span className="text-[var(--dash-line-strong)]" aria-hidden="true">
              |
            </span>
            <span>{verifiedCount} email verified</span>
            <span className="text-[var(--dash-line-strong)]" aria-hidden="true">
              |
            </span>
            <span>{unverifiedCount} unverified</span>
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="dash-tap inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[var(--dash-line-strong)] px-3 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Registrations shown" value={rows.length} hint="Newest first" emphasis />
        <StatTile
          label="Awaiting email confirmation"
          value={unverifiedCount}
          hint="Access is not blocked while unverified"
          tone={unverifiedCount > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label="Suspended"
          value={suspendedCount}
          hint="Storefront hidden from customers"
          tone={suspendedCount > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-4">
        <SectionCard
          title="Registrations"
          description="Search by restaurant name, storefront address or owner email."
          action={
            <FilterTabs
              value={filter}
              onChange={(next) => setFilter(next as typeof filter)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
              ]}
            />
          }
          padding="default"
        >
          <div className="mb-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search registrations" label="Search registrations" />
          </div>

          {error ? (
            <ErrorState description={error} onRetry={() => void load()} />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowKey={(row) => row.id}
              caption="Restaurants that registered themselves, newest first"
              loading={loading}
              initialSort={{ key: 'created_at', direction: 'desc' }}
              pageSize={25}
              renderMobile={(row) => (
                <div className="rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[var(--dash-ink-1)]">{row.name ?? 'Unnamed'}</p>
                      <p className="truncate text-[11.5px] text-[var(--dash-ink-4)]">
                        {row.slug ? `foodbase.ng/${row.slug}` : 'No storefront address'}
                      </p>
                    </div>
                    <StatusPill tone={row.is_active ? 'success' : 'danger'}>
                      {row.is_active ? 'Active' : 'Suspended'}
                    </StatusPill>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                    <div className="min-w-0">
                      <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">Owner</dt>
                      <dd className="truncate text-[var(--dash-ink-1)]">
                        {[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">Registered</dt>
                      <dd className="text-[var(--dash-ink-1)]">{relativeTime(row.created_at)}</dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--dash-ink-4)]">Email</dt>
                      <dd className="truncate text-[var(--dash-ink-1)]">
                        {row.email ?? '—'}{' '}
                        {row.email_verified === true ? (
                          <span className="text-[var(--dash-success)]">verified</span>
                        ) : row.email_verified === false ? (
                          <span className="text-[var(--dash-ink-4)]">unverified</span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2.5 flex items-center gap-2">
                    <Link
                      href={`/admin/businesses/${row.id}`}
                      className="dash-tap inline-flex h-8 items-center rounded-[6px] border border-[var(--dash-line-strong)] px-2.5 text-[11.5px] font-medium text-[var(--dash-ink-1)]"
                    >
                      Open business
                    </Link>
                    <button
                      type="button"
                      onClick={() => setTarget(row)}
                      className={`dash-tap inline-flex h-8 items-center rounded-[6px] border px-2.5 text-[11.5px] font-medium ${
                        row.is_active
                          ? 'border-[var(--dash-danger)]/30 text-[var(--dash-danger)]'
                          : 'border-[var(--dash-success)]/30 text-[var(--dash-success)]'
                      }`}
                    >
                      {row.is_active ? 'Suspend' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              )}
              empty={
                <EmptyState
                  icon={Store}
                  title={query || filter !== 'all' ? 'No registrations match that' : 'No self-registrations yet'}
                  description={
                    query || filter !== 'all'
                      ? 'Clear the search or switch the filter to see everything.'
                      : 'When a restaurant registers from the public page it appears here immediately.'
                  }
                  action={
                    query || filter !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch('')
                          setFilter('all')
                        }}
                        className="dash-tap inline-flex h-9 items-center rounded-[6px] border border-[var(--dash-line-strong)] px-3 text-[12px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
                      >
                        Clear filters
                      </button>
                    ) : undefined
                  }
                />
              }
            />
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={Boolean(target)}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        title={target?.is_active ? `Suspend ${target?.name ?? 'this restaurant'}?` : `Reactivate ${target?.name ?? 'this restaurant'}?`}
        description={
          target?.is_active
            ? 'Customers will see a closed storefront and cannot place new orders. The menu, orders, balances and payout account are all kept, and the owner keeps dashboard access.'
            : 'The storefront goes back online immediately and accepts orders again.'
        }
        confirmLabel={target?.is_active ? 'Suspend restaurant' : 'Reactivate restaurant'}
        tone={target?.is_active ? 'danger' : 'brand'}
        loading={saving}
        onConfirm={async () => {
          if (target) await changeStatus(target, !target.is_active)
        }}
      />
    </DashSurface>
  )
}
