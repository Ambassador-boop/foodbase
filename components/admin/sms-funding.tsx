'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Info, Landmark, Loader2, RefreshCw, ShieldAlert, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState, StatusPill, type Tone } from '@/components/admin/ui'
import { money, dateTimeWat } from '@/components/admin/format'
import { useAdminData } from '@/components/admin/use-admin-data'
import { usePinAuthorization } from '@/hooks/use-pin-authorization'
import { cn } from '@/lib/utils'
import type { SmsFundingRecord, SmsWalletResponse } from '@/components/admin/types'

/** Mirrors KUDISMS_VAT_RATE on the server for the pre-submit estimate only. */
export const SMS_VAT_RATE = 0.075

export function estimateWalletCredit(amount: number) {
  const send = Number.isFinite(amount) && amount > 0 ? amount : 0
  const vat = Math.round(send * SMS_VAT_RATE * 100) / 100
  return { send, vat, credit: Math.round((send - vat) * 100) / 100 }
}

export function smsStatus(status: SmsFundingRecord['status']): { tone: Tone; label: string } {
  const value = String(status ?? '').toLowerCase()
  if (['success', 'processed', 'completed'].includes(value)) return { tone: 'success', label: 'Completed' }
  if (['failed', 'rejected'].includes(value)) return { tone: 'danger', label: 'Failed' }
  if (['reversed'].includes(value)) return { tone: 'neutral', label: 'Reversed' }
  if (['otp'].includes(value)) return { tone: 'warning', label: 'Awaiting OTP' }
  return { tone: 'warning', label: 'Pending' }
}

export function useSmsWallet() {
  return useAdminData<SmsWalletResponse>('/api/admin/sms')
}

/** Balance display that never turns a failed lookup into ₦0. */
export function SmsBalanceValue({ wallet, className }: { wallet: SmsWalletResponse | null; className?: string }) {
  if (!wallet) return <span className={cn('text-muted-foreground', className)}>—</span>
  if (!wallet.balanceAvailable || wallet.balance === null) {
    return <span className={cn('text-muted-foreground', className)}>Balance unavailable</span>
  }
  return <span className={className}>{money(wallet.balance)}</span>
}

export function SmsLowBalanceBanner({ className, wallet: walletOverride }: { className?: string; wallet?: SmsWalletResponse | null } = {}) {
  const { data: fetched, loading, error, reload } = useSmsWallet()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  // `wallet` lets a harness render the banner with a fixed payload; production passes nothing.
  const data = walletOverride ?? fetched

  if (loading && !data) return null
  if (error && !data) return null
  if (!data || !data.isLow) return null

  return (
    <>
      <section
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
        aria-live="polite"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" strokeWidth={1.9} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--warning)]">
              SMS wallet is low: {money(data.balance)}
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-[var(--warning)]/85">
              Below the {money(data.lowThreshold)} safety line. Order and delivery messages will fail once the wallet is empty.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" variant="outline" className="h-9 border-[var(--warning)]/35 bg-card/50 sm:h-8" onClick={reload}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Refresh balance</span>
          </Button>
          <Button size="sm" className="h-9 gap-1.5 sm:h-8" onClick={() => setDialogOpen(true)}>
            <Wallet className="size-3.5" aria-hidden="true" />
            Fund SMS wallet
          </Button>
        </div>
      </section>
      <SmsFundingDialog open={dialogOpen} onOpenChange={setDialogOpen} wallet={data} onFunded={reload} />
    </>
  )
}

export function SmsFundingDialog({
  open,
  onOpenChange,
  wallet: walletProp,
  onFunded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallet?: SmsWalletResponse | null
  onFunded?: () => void
}) {
  const { data: fetched, reload } = useSmsWallet()
  const wallet = walletProp ?? fetched
  const { authorize, dialogs } = usePinAuthorization()

  const [amount, setAmount] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState('')
  const [problem, setProblem] = React.useState<{ message: string; reason?: string } | null>(null)
  const [result, setResult] = React.useState<{ status: string; transferId: string; amount: number } | null>(null)
  const [inFlight, setInFlight] = React.useState<SmsFundingRecord | null>(null)

  const minFunding = wallet?.minFunding ?? 1000
  const numeric = Number(String(amount).replace(/,/g, ''))
  const valid = Number.isFinite(numeric) && numeric >= minFunding
  const estimate = estimateWalletCredit(valid ? numeric : 0)
  const adminAvailable = wallet?.adminAvailable ?? 0
  const overBalance = valid && numeric > adminAvailable
  const blocked = Boolean(inFlight ?? wallet?.inFlight)

  React.useEffect(() => {
    if (!open) return
    setAmount('')
    setError('')
    setProblem(null)
    setResult(null)
    setInFlight(wallet?.inFlight ?? null)
    setSubmitting(false)
    reload()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const fund = async () => {
    if (submitting || blocked) return
    if (!valid) { setError(`Minimum SMS funding is ${money(minFunding)}`); return }
    if (overBalance) { setError('Your available platform revenue is not enough for this transfer'); return }
    setSubmitting(true)
    setError('')
    setProblem(null)
    try {
      const authorizationTicket = await authorize('sms_funding', { amount: numeric }, `Fund SMS wallet with ${money(numeric)}`)
      const response = await fetch('/api/admin/sms/fund', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numeric, authorizationTicket }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 409 && body?.inFlight) {
        setInFlight({
          id: body.inFlight.id,
          amount: Number(body.inFlight.amount ?? 0),
          status: body.inFlight.status,
          createdAt: body.inFlight.createdAt,
          failureReason: null,
        })
        setError(body.error || 'A funding transfer is already being processed')
        return
      }
      if (!response.ok) {
        setProblem({
          message: body?.error || 'Funding could not be started',
          reason: body?.code === 'FUNDING_PENDING' ? 'Wait for the transfer in progress to settle before starting another.' : undefined,
        })
        return
      }
      setResult({ status: String(body.status ?? 'pending'), transferId: String(body.transferId ?? ''), amount: numeric })
      setAmount('')
      reload()
      onFunded?.()
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return
      setProblem({ message: err instanceof Error ? err.message : 'Funding could not be started' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Fund SMS wallet</DialogTitle>
            <DialogDescription>
              Sends money from your platform revenue to the KudiSMS virtual account. Authorised with your PIN.
            </DialogDescription>
          </DialogHeader>

          {!wallet ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)] px-3.5 py-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" strokeWidth={1.9} aria-hidden="true" />
                <div>
                  <p className="text-[13px] font-semibold text-[var(--success)]">Transfer submitted</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[var(--success)]/85">
                    {money(result.amount)} is on its way to KudiSMS. Status: {smsStatus(result.status).label.toLowerCase()}. The wallet updates once KudiSMS confirms.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="num text-[11px] break-all text-muted-foreground">Ref {result.transferId}</p>
                <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {wallet.funding.configured ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3">
                  <div className="flex items-start gap-2.5">
                    <Landmark className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground">KudiSMS virtual account</p>
                      <p className="num mt-0.5 text-[13px] text-foreground">
                        {wallet.funding.bankName} · {wallet.funding.accountNumberMasked}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{wallet.funding.accountName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3.5 py-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" strokeWidth={1.9} aria-hidden="true" />
                  <div>
                    <p className="text-[13px] font-medium text-[var(--danger)]">Funding is not configured</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-[var(--danger)]/80">
                      {wallet.funding.error ?? 'Set the KudiSMS funding account before funding the wallet.'}
                    </p>
                  </div>
                </div>
              )}

              {blocked && inFlight ? (
                <div className="rounded-lg border border-[var(--warning)]/35 bg-[var(--warning-bg)] px-3.5 py-3">
                  <p className="text-[13px] font-medium text-[var(--warning)]">A transfer is already in progress</p>
                  <p className="mt-0.5 text-[12px] leading-5 text-[var(--warning)]/85">
                    {money(inFlight.amount)} submitted {dateTimeWat(inFlight.createdAt)}. You can start another once this one settles.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="sms-funding-amount" className="text-[12px] font-medium">Amount to send</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground">₦</span>
                  <Input
                    id="sms-funding-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={String(minFunding)}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                    disabled={submitting || blocked}
                    className="num h-10 pl-7 text-[15px]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[minFunding, minFunding * 2, minFunding * 5, minFunding * 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={submitting || blocked}
                      onClick={() => setAmount(String(preset))}
                      className={cn(
                        'num rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                        Number(amount) === preset ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {money(preset)}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-muted-foreground">
                  Minimum {money(minFunding)}. Platform revenue available: <span className="num">{money(adminAvailable)}</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">Estimate after VAT</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
                      KudiSMS charges {(SMS_VAT_RATE * 100).toFixed(1)}% VAT on every payment into the account.
                    </p>
                  </div>
                  <StatusPill tone="neutral">Estimate</StatusPill>
                </div>
                <p className="mt-2 text-[13px] leading-6 text-foreground">
                  {valid ? (
                    <>
                      You send <span className="num font-semibold">{money(estimate.send)}</span>. About{' '}
                      <span className="num font-semibold">{money(estimate.credit)}</span> will be added to your SMS wallet after VAT.
                    </>
                  ) : (
                    <>Enter an amount to see roughly what lands in the SMS wallet.</>
                  )}
                </p>
                {valid ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Estimate only. KudiSMS applies VAT, so the exact credit can differ slightly. The transfer itself is unchanged.
                  </p>
                ) : null}
              </div>

              {overBalance ? (
                <p className="text-[12px] text-[var(--danger)]">
                  This is more than your {money(adminAvailable)} platform revenue. Lower the amount.
                </p>
              ) : null}

              {problem ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3.5 py-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" strokeWidth={1.9} aria-hidden="true" />
                  <div>
                    <p className="text-[12px] font-medium text-[var(--danger)]">{problem.message}</p>
                    {problem.reason ? <p className="mt-0.5 text-[11px] text-[var(--danger)]/80">{problem.reason}</p> : null}
                  </div>
                </div>
              ) : null}
              {error ? <p className="text-[12px] text-[var(--danger)]">{error}</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <Button asChild variant="ghost" size="sm" className="justify-start text-muted-foreground">
                  <Link href="/admin/sms">
                    Open SMS wallet
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={submitting} className="h-10 sm:h-9">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={fund}
                    disabled={submitting || blocked || !valid || overBalance || !wallet.funding.configured}
                    className="h-10 min-w-[132px] gap-1.5 sm:h-9"
                  >
                    {submitting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Wallet className="size-3.5" aria-hidden="true" />}
                    {submitting ? 'Submitting' : blocked ? 'Transfer pending' : 'Fund with PIN'}
                  </Button>
                </div>
              </div>
              <p className="flex items-start gap-1.5 text-[11px] leading-4 text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                Your PIN authorises this transfer. The amount is reserved from platform revenue and returned in full if the transfer fails.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {dialogs}
    </>
  )
}

/** The five most recent funding transfers, as a table on desktop and cards on mobile. */
export function SmsFundingHistory({ records }: { records: SmsFundingRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No funding yet"
        description="Transfers into the KudiSMS wallet will appear here with their status and, if one fails, the reason."
      />
    )
  }

  return (
    <div className="divide-y divide-border">
      {records.map((record) => {
        const status = smsStatus(record.status)
        return (
          <div key={record.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="num text-[13px] font-medium text-foreground">{money(record.amount)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{dateTimeWat(record.createdAt)}</p>
              {record.failureReason ? (
                <p className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-[var(--danger)]">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{record.failureReason}</span>
                </p>
              ) : null}
            </div>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
          </div>
        )
      })}
    </div>
  )
}

/** The VAT estimate, stated once as a standing note wherever funding is offered. */
export function EstimateNote({ vatRate }: { vatRate: number }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
      <p className="text-[12px] leading-5 text-muted-foreground">
        KudiSMS charges {(vatRate * 100).toFixed(1)}% VAT on every payment into the virtual account. The funding dialog shows an
        estimate of what will be added to the SMS wallet after VAT. It is a guide only; the amount sent never changes.
      </p>
    </div>
  )
}
