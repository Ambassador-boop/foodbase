import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { getActiveBusinessForUser } from '@/lib/active-business'

const rowsOf = (raw: unknown): any[] =>
  Array.isArray(raw) ? raw : ((raw as any)?.rows ?? [])

const FAILED = new Set(['failed', 'rejected'])
const IN_PROGRESS = new Set([
  'pending',
  'processing',
  'requested',
  'queued',
  'otp',
  'received',
  'needs-attention',
  'needs_attention',
])

const isFailed = (status: unknown) => FAILED.has(String(status ?? '').toLowerCase())
const isInProgress = (status: unknown) =>
  IN_PROGRESS.has(String(status ?? '').toLowerCase())

/**
 * Payments still held in the pending bucket, with the refunds requested
 * against each one.
 *
 * Money model: a refund request immediately moves its amount out of the bucket
 * it belongs to (`fb_request_refund`), so a refund that is still in progress is
 * already held out of the business's pending balance. `net_settling` therefore
 * reports exactly what the settlement job will move, and the per-row refund
 * breakdown lets the UI say which part is processed and which is still in
 * flight. Nothing here writes to the database.
 */
export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get('auth_token')?.value ||
      req.headers.get('authorization')?.replace('Bearer ', '')
    const payload = token ? await verifyJWT(token) : null
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await getActiveBusinessForUser(
      (payload as any).userId || (payload as any).id,
    )
    if (!business) {
      return NextResponse.json({ error: 'No active business found' }, { status: 404 })
    }

    const transactions = rowsOf(
      await db.query(
        `SELECT t.id AS transaction_id,
                t.order_id,
                o.customer_name,
                t.amount,
                t.available_at,
                t.created_at,
                t.payment_reference
           FROM transactions t
           LEFT JOIN orders o ON o.id = t.order_id
          WHERE t.business_id = $1
            AND t.settlement_status = 'pending'
            AND t.balance_bucket = 'pending'
          ORDER BY t.available_at ASC, t.created_at ASC`,
        [business.id],
      ),
    )

    const transactionIds = transactions.map((row) => row.transaction_id).filter(Boolean)

    const refunds = transactionIds.length
      ? rowsOf(
          await db.query(
            `SELECT r.id,
                    r.transaction_id,
                    r.refund_amount,
                    r.amount AS legacy_amount,
                    r.status,
                    r.created_at,
                    r.processed_at
               FROM refunds r
              WHERE r.transaction_id = ANY($1::varchar[])
              ORDER BY r.created_at ASC`,
            [transactionIds],
          ),
        )
      : []

    const refundsByTransaction = new Map<string, any[]>()
    for (const refund of refunds) {
      const list = refundsByTransaction.get(refund.transaction_id) ?? []
      list.push({
        id: refund.id,
        amount: Number(refund.refund_amount ?? refund.legacy_amount ?? 0),
        status: String(refund.status ?? ''),
        created_at: refund.created_at,
        processed_at: refund.processed_at,
      })
      refundsByTransaction.set(refund.transaction_id, list)
    }

    const pending = transactions.map((row) => {
      const rowRefunds = refundsByTransaction.get(row.transaction_id) ?? []
      const live = rowRefunds.filter((refund) => !isFailed(refund.status))

      const refundedProcessed = live
        .filter((refund) => !isInProgress(refund.status))
        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
      const refundedInProgress = live
        .filter((refund) => isInProgress(refund.status))
        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)
      const refundedFailed = rowRefunds
        .filter((refund) => isFailed(refund.status))
        .reduce((sum, refund) => sum + Number(refund.amount || 0), 0)

      const amount = Number(row.amount || 0)
      const refunded = refundedProcessed + refundedInProgress

      return {
        order_id: row.order_id,
        transaction_id: row.transaction_id,
        customer_name: row.customer_name ?? null,
        customer_first_name:
          String(row.customer_name || '')
            .trim()
            .split(/\s+/)[0] || null,
        payment_reference: row.payment_reference ?? null,
        amount,
        gross: amount,
        available_at: row.available_at,
        created_at: row.created_at,
        refunded,
        refunded_processed: refundedProcessed,
        refunded_in_progress: refundedInProgress,
        refunded_failed: refundedFailed,
        // What the settlement job will actually move (kept for compatibility).
        net_settling: Math.max(0, amount - refunded),
        // Same figure with only confirmed refunds deducted, so the UI can be
        // explicit about money still in flight.
        net_after_processed: Math.max(0, amount - refundedProcessed),
        refunds: rowRefunds,
      }
    })

    const sum = (key: string) => pending.reduce((total, row) => total + Number((row as any)[key] || 0), 0)

    return NextResponse.json({
      pending,
      totals: {
        orders: pending.length,
        amount: sum('amount'),
        gross: sum('amount'),
        refunded: sum('refunded'),
        refunded_processed: sum('refunded_processed'),
        refunded_in_progress: sum('refunded_in_progress'),
        refunded_failed: sum('refunded_failed'),
        net_settling: sum('net_settling'),
        net_after_processed: sum('net_after_processed'),
        next_available_at:
          pending
            .map((row) => row.available_at)
            .filter(Boolean)
            .sort()[0] ?? null,
      },
    })
  } catch (error) {
    console.error(
      '[v0] pending settlements failed',
      error instanceof Error ? error.message : String(error),
      (error as any)?.code ? `postgres_code=${(error as any).code}` : '',
    )
    return NextResponse.json({ error: 'Failed to fetch pending settlements' }, { status: 500 })
  }
}
