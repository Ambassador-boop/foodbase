import { cn } from '@/lib/utils'
import { formatNaira, type NairaOptions } from '@/lib/format'

/**
 * MoneyAmount.
 *
 * Renders a naira amount from a NUMERIC string (what Postgres returns) or a
 * number, without ever doing floating-point arithmetic on the stored value:
 * lib/format.ts works on the decimal digits. Negatives read `-₦1,200.00`, with
 * the minus before the sign.
 *
 * The amount is always ink. A refund, a fee and a payout are all money; the
 * direction is carried by the minus sign and the label beside it, never by red
 * or green text. Tabular figures are always on, so columns line up.
 */
export type MoneyAmountProps = NairaOptions & {
  value: string | number | bigint | null | undefined
  size?: 'body' | 'small' | 'caption' | 'h3' | 'h2'
  weight?: 'normal' | 'medium' | 'semibold'
  className?: string
  /** Adds an accessible label in front of the figure, e.g. "Total". */
  label?: string
}

const SIZES: Record<NonNullable<MoneyAmountProps['size']>, string> = {
  caption: 'type-caption',
  small: 'type-small',
  body: 'type-body',
  h3: 'type-h3 font-[var(--font-display)]',
  h2: 'type-h2 font-[var(--font-display)]',
}

const WEIGHTS: Record<NonNullable<MoneyAmountProps['weight']>, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
}

export function MoneyAmount({
  value,
  symbol = true,
  decimals = 2,
  signed = false,
  size = 'body',
  weight = 'medium',
  className,
  label,
}: MoneyAmountProps) {
  const formatted = formatNaira(value, { symbol, decimals, signed })

  return (
    <span
      data-slot="money-amount"
      className={cn('tnum text-ink whitespace-nowrap', SIZES[size], WEIGHTS[weight], className)}
    >
      {label ? <span className="sr-only">{label} </span> : null}
      {formatted}
    </span>
  )
}
