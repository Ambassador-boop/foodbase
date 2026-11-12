'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SLOW_REFRESH_MS = 30_000
const FAST_REFRESH_MS = 8_000

/** Withdrawal states where the owner is waiting on money to leave. */
const ACTIVE_WITHDRAWAL = new Set(['pending', 'queued', 'otp', 'received'])

export interface PendingTotals {
  orders: number
  amount: number
  gross?: number
  refunded: number
  refunded_processed?: number
  refunded_in_progress?: number
  refunded_failed?: number
  net_settling: number
  net_after_processed?: number
  next_available_at?: string | null
}

export interface FinanceFeedState {
  business: any | null
  transactions: any[]
  withdrawals: any[]
  refunds: any[]
  settlements: any[]
  pending: any[]
  pendingTotals: PendingTotals | null
}

const EMPTY: FinanceFeedState = {
  business: null,
  transactions: [],
  withdrawals: [],
  refunds: [],
  settlements: [],
  pending: [],
  pendingTotals: null,
}

/**
 * Loads the finance feed and keeps it fresh.
 *
 * - 30s refresh while the tab is visible.
 * - Paused while the tab is hidden; refreshes the moment it comes back.
 * - 8s refresh only while a withdrawal is pending or queued, so the owner
 *   sees the payout land without hammering the API the rest of the time.
 * - In-flight requests are aborted when the page unmounts.
 */
export function useFinanceFeed() {
  const [state, setState] = useState<FinanceFeedState>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fast, setFast] = useState(false)
  const loadedRef = useRef(false)

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const [businessRes, transactionsRes, withdrawalsRes, refundsRes, settlementsRes, pendingRes] =
        await Promise.all([
          fetch('/api/business', { credentials: 'include', signal }),
          fetch('/api/business/transactions', { credentials: 'include', signal }),
          fetch('/api/business/withdrawals', { credentials: 'include', signal }),
          fetch('/api/business/refunds', { credentials: 'include', signal }),
          fetch('/api/business/settlements', { credentials: 'include', signal }),
          fetch('/api/business/settlements/pending', { credentials: 'include', signal }),
        ])

      if (signal.aborted) return

      const next: Partial<FinanceFeedState> = {}

      if (businessRes.ok) {
        next.business = (await businessRes.json())?.business ?? null
      }
      if (transactionsRes.ok) next.transactions = await transactionsRes.json()
      if (refundsRes.ok) next.refunds = await refundsRes.json()
      if (settlementsRes.ok) next.settlements = await settlementsRes.json()

      if (withdrawalsRes.ok) {
        const withdrawals = await withdrawalsRes.json()
        next.withdrawals = withdrawals
        const waiting =
          Array.isArray(withdrawals) &&
          withdrawals.some((withdrawal: any) =>
            ACTIVE_WITHDRAWAL.has(String(withdrawal?.status ?? '').toLowerCase()),
          )
        setFast(waiting)
        if (waiting) {
          // Reconcile with the provider so a completed payout shows up quickly.
          fetch('/api/business/reconcile-withdrawals', { credentials: 'include' }).catch(() => {})
        }
      }

      if (pendingRes.ok) {
        const body = await pendingRes.json()
        next.pending = body?.pending ?? []
        next.pendingTotals = body?.totals ?? null
      }

      if (signal.aborted) return
      setState((previous) => ({ ...previous, ...next }))
      setError(null)
      loadedRef.current = true
    } catch (err) {
      if ((err as any)?.name === 'AbortError' || signal.aborted) return
      console.error('[v0] finance feed failed:', err)
      setError('Could not refresh your balances. Retrying automatically.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const run = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      void load(controller.signal)
    }

    run()
    const interval = window.setInterval(run, fast ? FAST_REFRESH_MS : SLOW_REFRESH_MS)

    const onVisibilityChange = () => {
      // Coming back to the tab: refresh immediately instead of waiting.
      if (typeof document !== 'undefined' && !document.hidden) run()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(interval)
      controller.abort()
    }
  }, [load, fast])

  return { ...state, loading, error, fast, hasLoaded: loadedRef.current }
}
