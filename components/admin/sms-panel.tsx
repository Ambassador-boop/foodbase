'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle2, CircleSlash, Plus, RefreshCw, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, PanelSkeleton, StatusPill, ErrorState } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { dateTimeWat, money } from '@/components/admin/format'
import { EstimateNote, SmsFundingDialog, SmsFundingHistory, useSmsWallet } from '@/components/admin/sms-funding'
import type { SmsWalletResponse } from '@/components/admin/types'

export function SmsPanel({ wallet: walletOverride }: { wallet?: SmsWalletResponse | null } = {}) {
  const { data: fetched, loading, error, reload } = useSmsWallet()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  // `wallet` lets a harness render the panel with a fixed payload; production passes nothing.
  const data = walletOverride ?? fetched

  if (!data && loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <Panel><PanelSkeleton lines={4} /></Panel>
        </div>
        <div className="lg:col-span-2"><Panel><PanelSkeleton lines={6} /></Panel></div>
        <Panel><PanelSkeleton lines={5} /></Panel>
      </div>
    )
  }

  if (!data && error) {
    return <ErrorState message="The SMS wallet could not be loaded." onRetry={reload} />
  }

  if (!data) return null

  return (
    <div className="flex flex-col gap-4">
      {data.isLow ? (
        <section className="flex flex-col gap-3 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" strokeWidth={1.9} aria-hidden="true" />
            <div>
              <p className="text-[13px] font-semibold text-[var(--warning)]">
                SMS wallet is low: {data.balance === null ? 'Balance unavailable' : money(data.balance)}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-[var(--warning)]/85">
                Below the {money(data.lowThreshold)} safety line. Top up before order messages start failing.
              </p>
            </div>
          </div>
          <Button size="sm" className="h-9 shrink-0 gap-1.5 sm:h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Fund SMS wallet
          </Button>
        </section>
      ) : null}

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Live KudiSMS balance</p>
            <p className="mt-1.5 flex items-baseline gap-2">
              {data.balanceAvailable && data.balance !== null ? (
                <span className="num text-[30px] leading-9 font-semibold tracking-[-0.02em] text-foreground">{money(data.balance)}</span>
              ) : (
                <span className="text-[22px] leading-8 font-semibold text-muted-foreground">Balance unavailable</span>
              )}
              {data.isLow ? <StatusPill tone="warning">Low</StatusPill> : null}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
              {data.balanceAvailable ? (
                <span>Updated {data.balanceUpdatedAt ? dateTimeWat(data.balanceUpdatedAt) : 'just now'}</span>
              ) : (
                <span>
                  KudiSMS could not be reached
                  {data.lastKnownBalance !== null ? ` · last known ${money(data.lastKnownBalance)}` : ''}
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>Last funded {data.lastFundedAt ? dateTimeWat(data.lastFundedAt) : 'never'}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 sm:h-8" onClick={reload}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button size="sm" className="h-9 gap-1.5 sm:h-8" onClick={() => setDialogOpen(true)}>
              <Wallet className="size-3.5" aria-hidden="true" />
              Fund SMS wallet
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
          <div className="bg-card px-4 py-3 sm:px-5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.06em]">Low-balance line</p>
            <p className="num mt-1 text-[14px] font-medium text-foreground">{money(data.lowThreshold)}</p>
          </div>
          <div className="bg-card px-4 py-3 sm:px-5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.06em]">Minimum funding</p>
            <p className="num mt-1 text-[14px] font-medium text-foreground">{money(data.minFunding)}</p>
          </div>
          <div className="bg-card px-4 py-3 sm:px-5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.06em]">Platform revenue available</p>
            <p className="num mt-1 text-[14px] font-medium text-foreground">{money(data.adminAvailable)}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel
            title="Recent funding"
            description="The five most recent transfers into the SMS wallet, newest first."
          >
            <SmsFundingHistory records={data.recent} />
          </Panel>
        </div>
        <SetupCheck setup={data.setup} />
      </div>

      <EstimateNote vatRate={data.vatRate} />

      <SmsFundingDialog open={dialogOpen} onOpenChange={setDialogOpen} wallet={data} onFunded={reload} />
    </div>
  )
}

function SetupCheck({ setup }: { setup: SmsWalletResponse['setup'] }) {
  const matchBadge =
    setup.nameMatches === 'match' ? { tone: 'success' as const, label: 'Match' }
      : setup.nameMatches === 'mismatch' ? { tone: 'danger' as const, label: 'Mismatch' }
      : setup.nameMatches === 'unresolved' ? { tone: 'warning' as const, label: 'Unresolved' }
      : { tone: 'neutral' as const, label: 'Not set' }

  return (
    <Panel title="Setup check" description="Read-only. Values are masked.">
      <div className="flex flex-col">
        <SetupRow label="Funding account number">
          {setup.accountNumber.set ? (
            <>
              <span className="num text-[13px] font-medium text-foreground">{setup.accountNumber.masked}</span>
              <StatusPill tone={setup.accountNumber.valid ? 'success' : 'danger'}>{setup.accountNumber.valid ? 'Valid' : 'Invalid'}</StatusPill>
            </>
          ) : (
            <StatusPill tone="danger">Not set</StatusPill>
          )}
        </SetupRow>
        <SetupRow label="Expected account name">
          {setup.expectedName.set ? (
            <span className="num text-[13px] font-medium break-words text-foreground">{setup.expectedName.masked}</span>
          ) : (
            <StatusPill tone="neutral">Not set</StatusPill>
          )}
        </SetupRow>
        <SetupRow label="Resolved account name" hint={setup.resolved.bankName ? `via ${setup.resolved.bankName}` : undefined}>
          {setup.resolved.ok ? (
            <>
              <span className="num text-[13px] font-medium break-words text-foreground">{setup.resolved.masked}</span>
              <StatusPill tone={matchBadge.tone}>{matchBadge.label}</StatusPill>
            </>
          ) : (
            <StatusPill tone="warning">Unresolved</StatusPill>
          )}
        </SetupRow>
        <SetupRow label="Ready to fund" last>
          {setup.configured ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--success)]">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--danger)]">
              <CircleSlash className="size-3.5" aria-hidden="true" />
              No
            </span>
          )}
        </SetupRow>
        {!setup.configured && setup.resolved.error ? (
          <p className="mt-2 rounded-md bg-[var(--danger-bg)] px-2.5 py-2 text-[11px] leading-4 text-[var(--danger)]">{setup.resolved.error}</p>
        ) : null}
      </div>
    </Panel>
  )
}

function SetupRow({
  label,
  hint,
  last,
  children,
}: {
  label: string
  hint?: string
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1 py-2.5', !last && 'border-b border-border')}>
      <p className="text-[12px] text-muted-foreground">
        {label}
        {hint ? <span className="text-muted-foreground/70"> · {hint}</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">{children}</div>
    </div>
  )
}
