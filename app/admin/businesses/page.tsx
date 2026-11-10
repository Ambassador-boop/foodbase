'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Edit2, Eye, Plus, Store, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader, Panel, SearchField, StatusPill, TableSkeleton } from '@/components/admin/ui'
import { count, dateWat } from '@/components/admin/format'

interface Business {
  id: string
  name: string
  slug: string
  email: string
  phone?: string
  logo_url?: string
  created_at: string
  is_active: boolean
}

export default function BusinessesPage() {
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [deleting, setDeleting] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchBusinesses()
  }, [])

  const fetchBusinesses = async () => {
    setError('')
    try {
      const response = await fetch('/api/admin/businesses', { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to load businesses')
      setBusinesses(data.businesses || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  const deleteBusiness = async (businessId: string) => {
    if (!window.confirm('Are you sure you want to delete this business?')) return
    setDeleting(businessId)
    setError('')
    try {
      const response = await fetch(`/api/admin/businesses/${businessId}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete business')
      }
      setBusinesses((current) => current.filter((business) => business.id !== businessId))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete business')
    } finally {
      setDeleting(null)
    }
  }

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return businesses
    return businesses.filter(
      (business) =>
        business.name.toLowerCase().includes(term) ||
        (business.slug ?? '').toLowerCase().includes(term) ||
        (business.email ?? '').toLowerCase().includes(term),
    )
  }, [businesses, search])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Businesses"
        description="Every restaurant account on the platform."
        meta={
          <>
            <span>{count(businesses.length)} accounts</span>
            <span aria-hidden="true">·</span>
            <span>{count(businesses.filter((business) => business.is_active).length)} active</span>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link href="/admin/businesses/performance">Performance</Link>
            </Button>
            <Button asChild size="sm" className="h-9 gap-1.5">
              <Link href="/admin/businesses/register">
                <Plus className="size-4" aria-hidden="true" />
                Register business
              </Link>
            </Button>
          </>
        }
      />

      {error ? <ErrorState message={error} onRetry={fetchBusinesses} /> : null}

      <Panel
        title="All accounts"
        description="Open a business to see its storefront details, or edit its profile."
        action={<SearchField value={search} onChange={setSearch} placeholder="Search name, slug or email" label="Search businesses" />}
      >
        {loading ? (
          <TableSkeleton rows={6} columns={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Store}
            title={search ? 'No business matches that search' : 'No businesses registered yet'}
            description={
              search
                ? 'Try a different name, slug or email, or clear the search to see every account.'
                : 'Register the first business to start taking orders on the storefront.'
            }
            action={
              search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                  Clear search
                </Button>
              ) : (
                <Button asChild size="sm">
                  <Link href="/admin/businesses/register">Register business</Link>
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((business) => (
              <li key={business.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-card">
                <div className="flex items-start gap-3 p-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {business.logo_url ? (
                      <Image src={business.logo_url} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[13px] font-semibold text-muted-foreground">
                        {business.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-foreground">{business.name}</p>
                      <StatusPill tone={business.is_active ? 'success' : 'neutral'}>{business.is_active ? 'Active' : 'Inactive'}</StatusPill>
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">/{business.slug}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{business.email}</p>
                    {business.phone ? <p className="truncate text-[11px] text-muted-foreground">{business.phone}</p> : null}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5 border-t border-border p-2">
                  <Button asChild variant="ghost" size="sm" className="h-8 flex-1 gap-1 text-[12px]">
                    <Link href={`/admin/businesses/${business.id}`}>
                      <Eye className="size-3.5" aria-hidden="true" />
                      View
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" className="h-8 flex-1 gap-1 text-[12px]">
                    <Link href={`/admin/businesses/edit/${business.id}`}>
                      <Edit2 className="size-3.5" aria-hidden="true" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 flex-1 gap-1 text-[12px] text-[var(--danger)] hover:bg-[var(--danger-bg)] hover:text-[var(--danger)]"
                    onClick={() => deleteBusiness(business.id)}
                    disabled={deleting === business.id}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    {deleting === business.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
                <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">Added {dateWat(business.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
