import {
  ArrowCounterClockwise,
  Bank,
  BellRinging,
  CheckCircle,
  Clock,
  CookingPot,
  Prohibit,
  Wallet,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'

import { cn } from '@/lib/utils'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import type { VariantProps } from 'class-variance-authority'

/**
 * StatusBadge.
 *
 * Every state is a colour, an icon and a word. Colour alone is never the
 * signal: the icon distinguishes "ready" from "completed" and the word
 * distinguishes everything at a glance and in a screen reader.
 *
 * Three families, because they mean different things:
 *  - order       the kitchen and the customer
 *  - settlement  money the business already earned, moving from pending to
 *                available to paid out. Never green: it is a transfer, not a
 *                credit.
 *  - refund      money going back to a customer
 */

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

type StatusSpec = {
  word: string
  variant: BadgeVariant
  icon: React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill'; 'aria-hidden'?: boolean }>
}

const ORDER: Record<string, StatusSpec> = {
  pending: { word: 'Pending', variant: 'warning', icon: Clock },
  confirmed: { word: 'Confirmed', variant: 'info', icon: CheckCircle },
  preparing: { word: 'Preparing', variant: 'warning', icon: CookingPot },
  ready: { word: 'Ready', variant: 'success', icon: BellRinging },
  completed: { word: 'Completed', variant: 'neutral', icon: CheckCircle },
  cancelled: { word: 'Cancelled', variant: 'neutral', icon: Prohibit },
}

const SETTLEMENT: Record<string, StatusSpec> = {
  pending: { word: 'Pending', variant: 'warning', icon: Clock },
  available: { word: 'Available', variant: 'info', icon: Wallet },
  'paid out': { word: 'Paid out', variant: 'settled', icon: Bank },
  paid_out: { word: 'Paid out', variant: 'settled', icon: Bank },
  paidout: { word: 'Paid out', variant: 'settled', icon: Bank },
}

const REFUND: Record<string, StatusSpec> = {
  requested: { word: 'Requested', variant: 'warning', icon: Clock },
  approved: { word: 'Approved', variant: 'info', icon: CheckCircle },
  refunded: { word: 'Refunded', variant: 'success', icon: ArrowCounterClockwise },
  rejected: { word: 'Rejected', variant: 'neutral', icon: Prohibit },
  failed: { word: 'Failed', variant: 'danger', icon: WarningCircle },
}

const FAMILIES = { order: ORDER, settlement: SETTLEMENT, refund: REFUND } as const

export type StatusBadgeProps = {
  kind: keyof typeof FAMILIES
  status: string
  /** Overrides the word, for a longer label in a sentence. */
  label?: string
  className?: string
}

export function StatusBadge({ kind, status, label, className }: StatusBadgeProps) {
  const key = status.trim().toLowerCase()
  const spec = FAMILIES[kind][key] ?? FAMILIES[kind][key.replace(/\s+/g, '_')]

  // An unknown status still shows the raw word in a neutral badge rather than
  // disappearing, so a new database value is visible instead of invisible.
  if (!spec) {
    return (
      <Badge variant="neutral" className={className}>
        {label ?? status}
      </Badge>
    )
  }

  const Icon = spec.icon

  return (
    <Badge variant={spec.variant} className={cn('gap-1', className)}>
      <Icon weight="bold" aria-hidden />
      {label ?? spec.word}
    </Badge>
  )
}
