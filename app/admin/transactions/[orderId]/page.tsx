'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Info, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, KeyValue, Money, PageHeader, Panel, PanelSkeleton, StatusBadge, StatusPill } from '@/components/admin/ui'
import { dateTimeWat, money } from '@/components/admin/format'
import { useAdminData } from '@/components/admin/use-admin-data'

interface DetailResponse {
  order: Record<string, any>
  transactions: Array<Record<string, any>>
  items: Array<{ id: string; item_name: string | null; quantity: number; item_price: number; configuration: unknown }>
  refunds: Array<Record<string, any>>
  isPaid: boolean
  paystack: Record<string, any> | null
}

export default function TransactionDetailPage() {
  const params = useParams<{ orderId: string }>()
  const orderId = params?.orderId
  const { data, loading, error, reload } = useAdminData<DetailResponse>(orderId ? `/api/admin/transactions/${orderId}` : null)

  const order = data?.order
  const paid = data?.isPaid
  const providerFee = order?.provider_fee ?? data?.transactions?.find((entry) => entry.provider_fee !== null && entry.provider_fee !== undefined)?.provider_fee ?? null
  const settlement = data?.transactions?.find((entry) => entry.settlement_status)?.settlement_status ?? null
  const refunded = (data?.refunds ?? []).filter((refund) => String(refund.status).toLowerCase() === 'processed').reduce((total, refund) => total + Number(refund.refund_amount ?? 0), 0)

  const itemsTotal = (data?.items ?? []).reduce((total, item) => total + Number(item.item_price ?? 0) * Number(item.quantity ?? 1), 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[12px] text-muted-foreground">
          <Link href="/admin/transactions">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Transactions
          </Link>
        </Button>
      </div>

      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {!data && loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card px-4 py-4">
              <PanelSkeleton lines={5} />
            </div>
          ))}
        </div>
      ) : null}

      {order ? (
        <>
          <PageHeader
            title={`Order ${String(order.id).slice(0, 12)}`}
            description={order.business_name ? `${order.business_name} · ${order.customer_name || order.customer_email || 'Customer'}` : undefined}
            meta={
              <>
                <StatusBadge status={order.payment_status} />
                {settlement ? <StatusPill tone={String(settlement).toLowerCase() === 'settled' ? 'success' : 'warning'}>{settlement}</StatusPill> : null}
                <span>{dateTimeWat(order.paid_at || order.created_at)}</span>
                {order.payment_reference ? <span className="font-mono text-[11px]">{order.payment_reference}</span> : null}
              </>
            }
          />

          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-accent px-3 py-2 text-[12px] text-accent-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Admin only. Nothing on this page can be changed here; payments, refunds and settlements are handled by their own flows.
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Payment" description="What the customer paid and where it went.">
              <div className="space-y-0">
                <KeyValue label="Order total" value={<Money value={Number(order.total_amount ?? 0)} />} />
                <KeyValue
                  label="Service fee"
                  hint={paid ? 'Credited to platform revenue' : 'Only credited when the order is paid'}
                  value={<Money value={Number(order.service_fee_amount ?? 0)} />}
                />
                <KeyValue
                  label="Paystack fee"
                  hint={providerFee === null ? 'Not recorded for this payment' : 'Recorded from the payment provider'}
                  value={providerFee === null ? <span className="text-muted-foreground">Not recorded</span> : <Money value={Number(providerFee)} />}
                />
                <KeyValue
                  label="Net to business"
                  hint="Order total minus service fee and provider fee"
                  value={<Money value={Number(order.total_amount ?? 0) - Number(order.service_fee_amount ?? 0) - Number(providerFee ?? 0)} />}
                />
                <KeyValue
                  label="Refunded"
                  hint={(data?.refunds ?? []).length > 0 ? `${(data?.refunds ?? []).length} refund record(s)` : 'No refunds recorded'}
                  value={<Money value={refunded} />}
                  tone={refunded > 0 ? 'danger' : 'default'}
                  border={false}
                />
              </div>
            </Panel>

            <Panel title="Customer and delivery" description="Details captured at checkout.">
              <div className="space-y-0">
                <KeyValue label="Customer" value={order.customer_name || '—'} />
                <KeyValue label="Email" value={order.customer_email || '—'} />
                <KeyValue label="Phone" value={order.customer_phone || '—'} />
                <KeyValue label="Address" value={order.address || '—'} />
                <KeyValue label="Notes" value={order.notes || '—'} />
                <KeyValue label="Order status" value={<StatusBadge status={order.status} />} border={false} />
              </div>
            </Panel>

            <Panel title="Items" description={`${(data?.items ?? []).length} line item(s).`}>
              {(data?.items ?? []).length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No order items were stored for this order.</p>
              ) : (
                <div className="space-y-2">
                  {(data?.items ?? []).map((item) => {
                    const configuration = Array.isArray(item.configuration) ? item.configuration : []
                    return (
                      <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-[13px] text-foreground">
                            {item.item_name ?? 'Item'} <span className="text-muted-foreground">× {item.quantity}</span>
                          </p>
                          {configuration.length > 0 ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {configuration
                                .map((addon) => (typeof addon === 'object' && addon && 'name' in addon ? String((addon as Record<string, unknown>).name) : ''))
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          ) : null}
                        </div>
                        <Money value={item.item_price * item.quantity} className="shrink-0 text-[13px]" />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
                    <span className="text-muted-foreground">Items subtotal</span>
                    <span className="num font-medium">
                      <Money value={itemsTotal} />
                    </span>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Payment records" description="Transactions written by the payment flow.">
              {(data?.transactions ?? []).length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-3 py-2.5 text-[12px] text-[var(--danger)]">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  No payment transaction exists for this order. If it is marked paid, it appears in the alerts queue.
                </div>
              ) : (
                <ul className="space-y-2">
                  {(data?.transactions ?? []).map((transaction) => (
                    <li key={String(transaction.id)} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-foreground">
                          {String(transaction.transaction_type ?? 'payment')} · {String(transaction.status ?? '')}
                        </span>
                        <Money value={Number(transaction.amount ?? 0)} className="text-[13px]" />
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Settlement: {String(transaction.settlement_status ?? 'pending')}</span>
                        <span>Provider fee: {transaction.provider_fee === null || transaction.provider_fee === undefined ? 'Not recorded' : money(Number(transaction.provider_fee))}</span>
                        <span>{dateTimeWat(transaction.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {data?.paystack ? (
                <details className="mt-3 rounded-lg border border-border px-3 py-2">
                  <summary className="cursor-pointer text-[12px] font-medium text-muted-foreground">Provider response</summary>
                  <pre className="mt-2 max-h-56 overflow-auto text-[10px] leading-4 text-muted-foreground">
                    {JSON.stringify(data.paystack, null, 2)}
                  </pre>
                </details>
              ) : null}
            </Panel>

            {(data?.refunds ?? []).length > 0 ? (
              <Panel title="Refunds" description="Refund attempts recorded for this order." className="lg:col-span-2">
                <ul className="divide-y divide-border">
                  {(data?.refunds ?? []).map((refund) => (
                    <li key={String(refund.id)} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-[13px] text-foreground">
                          <Money value={Number(refund.refund_amount ?? 0)} /> · {String(refund.reason ?? 'No reason recorded')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{dateTimeWat(refund.created_at)}</p>
                      </div>
                      <StatusBadge status={refund.status} />
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </div>

          <div className="flex items-start gap-1.5 rounded-xl border border-border bg-card px-4 py-3 text-[11px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <p>
              Provider fee is only shown when the payment record contains it. Older payments were written before the fee was
              captured, so they show “Not recorded” instead of a misleading zero.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
