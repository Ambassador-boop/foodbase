import { Clock3 } from 'lucide-react'

/**
 * "Not taking orders right now" notice for the cart and checkout.
 *
 * Shown only when the restaurant has turned off orders outside its opening
 * hours and it is currently closed (see isOrderingPaused). Browsing, cart edits
 * and everything else on the page keep working: this explains the one action
 * that is unavailable, and when it comes back.
 *
 * Presentational only, no hooks, so both client pages render it as is.
 */

type Props = {
  /** Used in the sentence: "<name> isn't taking orders right now." */
  restaurantName?: string | null
  /** "Opens today at 10:00 AM" from the server, or null when unknown. */
  opensAt?: string | null
  className?: string
}

/** The reopening clause as its own sentence, or a calm fallback. */
export function reopeningSentence(opensAt?: string | null): string {
  return opensAt ? `${opensAt}.` : 'They will open again soon.'
}

export function OrderingPausedNotice({ restaurantName, opensAt, className }: Props) {
  const who = restaurantName?.trim()

  return (
    <section
      role="status"
      aria-live="polite"
      className={[
        'rounded-xl border border-border border-l-[3px] border-l-primary bg-card px-4 py-3.5 sm:px-5 sm:py-4',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <Clock3
          className="mt-[3px] h-3.5 w-3.5 shrink-0 text-primary"
          aria-hidden="true"
          strokeWidth={2}
        />
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">
            Ordering paused
          </p>
          <p className="mt-1 text-[13.5px] font-semibold leading-snug text-foreground sm:text-sm">
            {who
              ? `${who} isn’t taking orders right now.`
              : 'This restaurant isn’t taking orders right now.'}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13px]">
            {reopeningSentence(opensAt)} Your cart is saved, so you can keep browsing and changing
            items. Nothing is charged while ordering is paused.
          </p>
        </div>
      </div>
    </section>
  )
}

/**
 * One muted line to sit directly under a disabled pay / place-order button, so
 * the reason is never more than a glance away from the thing that is disabled.
 */
export function OrderingPausedButtonNote({
  opensAt,
  className,
}: {
  opensAt?: string | null
  className?: string
}) {
  return (
    <p
      className={[
        'text-center text-[11.5px] leading-relaxed text-muted-foreground',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {opensAt ? `${opensAt} to order.` : 'Ordering reopens when they open.'}
    </p>
  )
}
