import { ArrowDownToLine, ArrowUpRight, Landmark, Search, Undo2 } from 'lucide-react'
import Link from 'next/link'

import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/finance/status-badge'
import { cn } from '@/lib/utils'

export type ActivityKind = 'income' | 'withdrawal' | 'refund' | 'settlement'

/**
 * One line in the money-movement feed. Settlements use the warm slate
 * settlement tone (a transfer between the owner's own balances), never the
 * green credit or red debit tones reserved for money entering or leaving.
 */
export function ActivityRow({
  kind,
  title,
  subtitle,
  amount,
  status,
  href,
  meta,
}: {
  kind: ActivityKind | string
  title: React.ReactNode
  subtitle?: React.ReactNode
  amount?: React.ReactNode
  status?: string
  href?: string
  meta?: React.ReactNode
}) {
  const failedRefund =
    kind === 'refund' && status
      ? ['failed', 'rejected'].includes(String(status).toLowerCase())
      : false

  const Icon =
    kind === 'income'
      ? ArrowDownToLine
      : kind === 'withdrawal'
        ? ArrowUpRight
        : kind === 'refund'
          ? Undo2
          : Landmark

  const chip =
    kind === 'income'
      ? 'bg-[#E6F6EC] text-[#1F9D55]'
      : kind === 'refund'
        ? failedRefund
          ? 'bg-[var(--settle-bg)] text-[var(--settle)]'
          : 'bg-[#FDE9E7] text-[#D64545]'
        : kind === 'withdrawal'
          ? 'bg-[#FFF4D6] text-[#B7791F]'
          : 'bg-[var(--settle-bg)] text-[var(--settle)]'

  const tone =
    failedRefund || kind === 'settlement'
      ? 'text-foreground'
      : kind === 'income'
        ? 'text-[#1F9D55]'
        : kind === 'refund'
          ? 'text-[#D64545]'
          : 'text-foreground'

  return (
    <Link
      href={href || '#'}
      className="flex items-start gap-3 border-b border-border py-3.5 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl',
          chip,
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {subtitle}
          {meta ? <span className="text-muted-foreground/80"> · {meta}</span> : null}
        </span>
        {failedRefund && (
          <span className="mt-1.5 block">
            <StatusBadge status="failed" variant="neutral">
              Failed, returned to your balance
            </StatusBadge>
          </span>
        )}
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={cn(
            'block text-sm font-semibold num',
            tone,
            failedRefund && 'line-through opacity-60',
          )}
        >
          {amount}
        </span>
        {status && !failedRefund && (
          <StatusBadge
            status={status}
            variant={kind === 'refund' ? 'neutral' : undefined}
          />
        )}
      </span>
    </Link>
  )
}

export function DayGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <div>{children}</div>
    </section>
  )
}

export function FeedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: readonly string[]
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Filter money movement"
      className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={cn(
            'shrink-0 rounded-full px-3 py-2 text-xs capitalize transition-colors',
            value === tab
              ? 'bg-white font-medium shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

export function FeedSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  return (
    <div className="relative w-full md:w-56">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search activity"
        aria-label="Search activity"
        className="h-10 bg-input pl-9"
      />
    </div>
  )
}
