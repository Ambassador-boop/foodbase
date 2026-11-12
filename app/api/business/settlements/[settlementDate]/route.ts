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

const WAT_DATE = `(((fr.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Lagos')::date)`

/**
 * One settlement day, as a statement.
 *
 * `finance_records` holds the authoritative amount moved into the available
 * balance (`fr.amount`). The gross and the refunds before settlement are
 * reconstructed around it so the statement can be checked:
 *
 *     gross received − refunds before settlement = settled
 *
 * Refunds requested after the settlement ran came out of the available
 * balance instead, so they are reported separately and never subtracted twice.
 *
 * Read-only: no statement, no schema change, no write.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ settlementDate: string }> },
) {
  try {
    const rawDate = decodeURIComponent((await params).settlementDate || '')
    const settlementDate = rawDate.slice(0, 10)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(settlementDate)) {
      return NextResponse.json(
        { error: 'Invalid settlement date format. Use YYYY-MM-DD' },
        { status: 400 },
      )
    }

    const token =
      request.cookies.get('auth_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '')
    const payload = token ? await verifyJWT(token) : null
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const business = await getActiveBusinessForUser(
      (payload as any).userId || (payload as any).id,
    )
    if (!business) {
      return NextResponse.json({ error: 'No active business found' }, { status: 404 })
    }

    const rawRecords = rowsOf(
      await db.query(
        `SELECT fr.id,
                fr.related_id,
                fr.amount AS settled_amount,
                fr.created_at AS settled_at,
                t.id AS transaction_id,
                t.order_id,
                t.amount AS received_amount,
                o.customer_name,
                o.paid_at
           FROM finance_records fr
           LEFT JOIN transactions t
                  ON (t.order_id = fr.related_id OR t.id = fr.related_id)
           LEFT JOIN orders o ON o.id = t.order_id
          WHERE fr.business_id = $1
            AND fr.record_type = 'settlement'
            AND ${WAT_DATE} = $2::date
          ORDER BY fr.created_at ASC`,
        [business.id, settlementDate],
      ),
    )

    // The join can only duplicate a record if `related_id` matches both an
    // order id and a transaction id; keep the first row per finance record.
    const byRecordId = new Map<string, any>()
    for (const row of rawRecords) {
      if (row && !byRecordId.has(row.id)) byRecordId.set(row.id, row)
    }
    const records = Array.from(byRecordId.values())

    const settledAt = records.reduce<string | null>((latest, row) => {
      if (!row.settled_at) return latest
      if (!latest) return row.settled_at
      return new Date(row.settled_at) > new Date(latest) ? row.settled_at : latest
    }, null)

    const transactionIds = records.map((row) => row.transaction_id).filter(Boolean)
    const refundRows = transactionIds.length
      ? rowsOf(
          await db.query(
            `SELECT r.id,
                    r.transaction_id,
                    r.order_id,
                    r.refund_amount,
                    r.amount AS legacy_amount,
                    r.status,
                    r.failure_reason,
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
    for (const refund of refundRows) {
      const list = refundsByTransaction.get(refund.transaction_id) ?? []
      list.push({
        id: refund.id,
        amount: Number(refund.refund_amount ?? refund.legacy_amount ?? 0),
        status: String(refund.status ?? ''),
        failure_reason: refund.failure_reason ?? null,
        created_at: refund.created_at,
        processed_at: refund.processed_at,
        order_id: refund.order_id,
      })
      refundsByTransaction.set(refund.transaction_id, list)
    }

    const settledTime = settledAt ? new Date(settledAt).getTime() : null

    const settlements = records.map((row) => {
      const all = refundsByTransaction.get(row.transaction_id) ?? []
      const live = all.filter((refund) => !isFailed(refund.status))

      // A refund row exists from the moment it is requested, and the settlement
      // job sums every non-failed refund that exists when it runs. Classify by
      // request time so "before settlement" matches what was actually counted.
      const before =
        settledTime == null
          ? live
          : live.filter((refund) => new Date(refund.created_at).getTime() <= settledTime)
      const after =
        settledTime == null
          ? []
          : live.filter((refund) => new Date(refund.created_at).getTime() > settledTime)

      const refundedBefore = before.reduce((sum, refund) => sum + refund.amount, 0)
      const refundedAfter = after.reduce((sum, refund) => sum + refund.amount, 0)
      const settled = Number(row.settled_amount || 0)
      const received = row.received_amount == null ? settled : Number(row.received_amount)

      const liveStatuses = live.map((refund) => refund.status)
      const refundState = (() => {
        if (!all.length) return 'none'
        if (!liveStatuses.length) return 'failed'
        const hasInProgress = liveStatuses.some(isInProgress)
        const hasProcessed = liveStatuses.some((status) => !isInProgress(status))
        if (hasInProgress && hasProcessed) return 'mixed'
        if (hasInProgress) return 'in_progress'
        return 'processed'
      })()

      return {
        // Existing shape.
        transaction_id: row.transaction_id || row.related_id,
        order_id: row.order_id || row.related_id,
        customer_first_name:
          String(row.customer_name || '').trim().split(/\s+/)[0] || null,
        received,
        refunded: refundedBefore + refundedAfter,
        settled,
        state:
          settled === 0 && refundedBefore + refundedAfter > 0
            ? 'fully_refunded'
            : refundedBefore + refundedAfter > 0
              ? 'partly_refunded'
              : 'settled',
        refunds: live.map((refund) => ({
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          created_at: refund.created_at,
        })),
        created_at: row.settled_at,
        // Additive fields.
        paid_at: row.paid_at ?? null,
        refunded_before: refundedBefore,
        refunded_after: refundedAfter,
        expected_net: received - refundedBefore,
        difference: Number((settled - (received - refundedBefore)).toFixed(2)),
        refund_state: refundState,
        refunds_all: all.map((refund) => ({
          id: refund.id,
          amount: refund.amount,
          status: refund.status,
          failure_reason: refund.failure_reason,
          created_at: refund.created_at,
          processed_at: refund.processed_at,
        })),
      }
    })

    const gross = settlements.reduce((sum, row) => sum + row.received, 0)
    const refundedBefore = settlements.reduce((sum, row) => sum + row.refunded_before, 0)
    const refundedAfter = settlements.reduce((sum, row) => sum + row.refunded_after, 0)
    const settled = settlements.reduce((sum, row) => sum + row.settled, 0)
    const expectedNet = Number((gross - refundedBefore).toFixed(2))

    return NextResponse.json({
      settlement_date: settlementDate,
      summary: {
        // Existing shape.
        orders: settlements.length,
        gross,
        refunded: refundedBefore + refundedAfter,
        settled,
        settled_at: settledAt,
        // Additive fields.
        refunded_before: refundedBefore,
        refunded_after: refundedAfter,
        expected_net: expectedNet,
        difference: Number((settled - expectedNet).toFixed(2)),
        reconciles: Math.abs(settled - expectedNet) < 0.005,
      },
      settlements,
      refunds_after_settlement: settlements
        .filter((row) => row.refunded_after > 0)
        .map((row) => ({
          order_id: row.order_id,
          customer_first_name: row.customer_first_name,
          amount: row.refunded_after,
          refunds: (row.refunds_all ?? []).filter(
            (refund) =>
              !FAILED.has(String(refund.status).toLowerCase()) &&
              settledTime != null &&
              new Date(refund.created_at).getTime() > settledTime,
          ),
        })),
    })
  } catch (error) {
    console.error(
      '[v0] settlement detail route failed',
      error instanceof Error ? error.message : String(error),
      (error as any)?.code ? `postgres_code=${(error as any).code}` : '',
    )
    return NextResponse.json({ error: 'Failed to fetch settlement details' }, { status: 500 })
  }
}
