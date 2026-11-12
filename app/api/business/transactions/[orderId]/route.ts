import { NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { maskEmail } from '@/lib/mask'

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

function paymentStatus(status: unknown) {
  const value = String(status || '').toLowerCase()
  if (['success', 'paid', 'completed'].includes(value)) return 'success'
  if (['failed', 'failure'].includes(value)) return 'failed'
  if (['abandoned', 'reversed'].includes(value)) return value
  return 'pending'
}

function methodLabel(method: unknown) {
  const value = String(method || '').toLowerCase()
  if (value.includes('card')) return 'Card'
  if (value.includes('bank')) return 'Bank transfer'
  if (value.includes('ussd')) return 'USSD'
  return 'Online payment'
}

/**
 * One transaction, as seen by the business that owns it.
 *
 * The response is additive only: the original keys are unchanged and the
 * settlement block gains the refund breakdown so the UI can show what a
 * pending payment will actually settle at.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth_token')?.value
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const payload = await verifyJWT(token)
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    const userId = (payload as any).userId || (payload as any).id
    const { orderId } = await params

    const order = rowsOf(
      await db.query(
        `SELECT o.id, o.business_id, o.customer_name, o.customer_email, o.customer_phone,
                o.address, o.notes, o.status, o.payment_status, o.payment_reference,
                o.total_amount, o.service_fee_amount, o.created_at, o.paid_at, o.completed_at,
                b.name AS business_name
           FROM orders o
           JOIN businesses b ON b.id = o.business_id
          WHERE o.id = $1 AND b.owner_id = $2`,
        [orderId, userId],
      ),
    )[0]

    if (!order) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const items = rowsOf(
      await db.query(
        `SELECT oi.id, oi.menu_item_id, oi.quantity, oi.item_price, oi.configuration,
                mi.name AS menu_item_name, mi.image_url AS menu_item_image
           FROM order_items oi
           LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
          WHERE oi.order_id = $1
          ORDER BY oi.created_at ASC`,
        [orderId],
      ),
    ).map((item: any) => ({
      id: item.id,
      menu_item_id: item.menu_item_id,
      name: item.menu_item_name,
      image: item.menu_item_image,
      quantity: item.quantity,
      item_price: Number(item.item_price || 0),
      configuration: item.configuration,
    }))

    const refunds = rowsOf(
      await db.query(
        `SELECT id, refund_amount, amount, status, reason, created_at, processed_at, failure_reason
           FROM refunds
          WHERE order_id = $1
          ORDER BY created_at DESC`,
        [orderId],
      ),
    ).map((refund: any) => ({
      id: refund.id,
      amount: Number(refund.refund_amount ?? refund.amount ?? 0),
      status: refund.status,
      reason: refund.reason,
      created_at: refund.created_at,
      processed_at: refund.processed_at,
      failure_reason: refund.failure_reason,
    }))

    const tx = rowsOf(
      await db.query(
        `SELECT amount, payment_method, balance_bucket, settlement_status,
                available_at, settled_at
           FROM transactions
          WHERE order_id = $1
          ORDER BY created_at ASC
          LIMIT 1`,
        [orderId],
      ),
    )[0]

    const liveRefunds = refunds.filter((refund) => !isFailed(refund.status))
    const refundedProcessed = liveRefunds
      .filter((refund) => !isInProgress(refund.status))
      .reduce((sum, refund) => sum + refund.amount, 0)
    const refundedInProgress = liveRefunds
      .filter((refund) => isInProgress(refund.status))
      .reduce((sum, refund) => sum + refund.amount, 0)

    const netReceived = tx ? Number(tx.amount || 0) : null

    // What actually landed in the available balance, when it did. `tx.amount`
    // is the customer's payment; the settlement record is the money movement.
    const settlementRecord = rowsOf(
      await db.query(
        `SELECT amount, created_at
           FROM finance_records
          WHERE record_type = 'settlement'
            AND business_id = $1
            AND related_id = ANY($2::varchar[])
          ORDER BY created_at DESC
          LIMIT 1`,
        [
          order.business_id,
          [order.id, tx?.id].filter(Boolean),
        ],
      ),
    )[0]

    // `finance_records` records the moment of settlement in `created_at`.
    const settledAt = settlementRecord?.created_at ?? tx?.settled_at ?? null
    const settledAtMs = settledAt ? new Date(settledAt).getTime() : null
    const isSettled =
      settlementRecord != null ||
      String(tx?.settlement_status ?? '').toLowerCase() === 'settled'

    // Refunds processed before the settlement were already taken out of the
    // settled amount; only later ones came out of the available balance.
    let refundedBeforeSettlement = 0
    let refundedAfterSettlement = 0
    for (const refund of liveRefunds) {
      const happenedAfter =
        isSettled &&
        settledAtMs != null &&
        new Date(refund.created_at).getTime() > settledAtMs
      if (happenedAfter) refundedAfterSettlement += refund.amount
      else refundedBeforeSettlement += refund.amount
    }

    const settledAmount =
      settlementRecord != null ? Number(settlementRecord.amount || 0) : null

    return NextResponse.json({
      order: {
        id: order.id,
        customer_name: order.customer_name,
        customer_email_masked: maskEmail(order.customer_email),
        customer_phone: order.customer_phone,
        address: order.address,
        notes: order.notes,
        status: order.status,
        payment_status: order.payment_status,
        payment_reference: order.payment_reference,
        total_amount: Number(order.total_amount || 0),
        service_fee_amount: Number(order.service_fee_amount || 0),
        created_at: order.created_at,
        paid_at: order.paid_at,
        completed_at: order.completed_at,
        business_name: order.business_name,
      },
      items,
      refunds,
      payment: {
        status: paymentStatus(order.payment_status),
        method_label: methodLabel(tx?.payment_method),
        paid_at: order.paid_at,
      },
      settlement: {
        // Existing shape.
        net_received: netReceived,
        balance_bucket: tx?.balance_bucket ?? null,
        settlement_status: tx?.settlement_status ?? null,
        available_at: tx?.available_at ?? null,
        settled_at: tx?.settled_at ?? null,
        // Additive: what this payment settles at once refunds are applied.
        refunded_processed: refundedProcessed,
        refunded_in_progress: refundedInProgress,
        refunded_total: refundedProcessed + refundedInProgress,
        refunded_before_settlement: refundedBeforeSettlement,
        refunded_after_settlement: refundedAfterSettlement,
        settled_amount: settledAmount,
        net_after_refunds: isSettled
          ? Math.max(0, Number(settledAmount ?? netReceived ?? 0) - refundedAfterSettlement)
          : netReceived == null
            ? null
            : Math.max(0, netReceived - refundedBeforeSettlement),
      },
    })
  } catch (error) {
    console.error(
      '[v0] business transaction privacy route failed',
      error instanceof Error ? error.message : String(error),
      (error as any)?.code ? `postgres_code=${(error as any).code}` : '',
    )
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 })
  }
}
