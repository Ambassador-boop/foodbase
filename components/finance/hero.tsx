import { Button } from '@/components/ui/button'
import { NGN } from '@/components/finance/money'

/**
 * Balance hero. "Pending" is always the figure the business will actually
 * receive after every refund already requested against those payments, so it
 * matches the settlement that will run, not the raw gross.
 */
export function FinanceHero({
  available,
  pending,
  nextSettlement,
  onWithdraw,
  pendingOrders,
  pendingRefunded,
  pendingNote,
}: {
  available: number
  pending: number
  nextSettlement?: string | null
  onWithdraw?: () => void
  pendingOrders?: number
  pendingRefunded?: number
  pendingNote?: string | null
}) {
  const negative = available < 0
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[var(--primary)] p-5 text-white md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-white/75">Available balance</p>
          <p className="mt-2 text-3xl font-semibold num md:text-4xl">
            {negative ? '−' : ''}
            {NGN(Math.abs(available))}
          </p>
          {negative && (
            <span className="mt-2 inline-flex rounded-full bg-white/20 px-2 py-1 text-xs">
              Deficit
            </span>
          )}
          <div className="mt-4 space-y-1">
            <p className="text-sm text-white/85">
              Pending {NGN(pending)}
              {typeof pendingOrders === 'number' && pendingOrders > 0
                ? ` · ${pendingOrders} ${pendingOrders === 1 ? 'order' : 'orders'}`
                : ''}
            </p>
            {!!pendingRefunded && pendingRefunded > 0 && (
              <p className="text-xs text-white/65">
                Net of {NGN(pendingRefunded)} refunded or held for refund
              </p>
            )}
            {nextSettlement && (
              <p className="text-xs text-white/65">Next settlement {nextSettlement}</p>
            )}
            {pendingNote && <p className="text-xs text-white/65">{pendingNote}</p>}
          </div>
        </div>
        <Button variant="secondary" onClick={onWithdraw} className="shrink-0">
          Withdraw
        </Button>
      </div>
    </section>
  )
}
