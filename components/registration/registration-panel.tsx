import Image from 'next/image'
import Link from 'next/link'

/**
 * The right-hand panel on /register/restaurant.
 *
 * Art direction: one tall kitchen photograph, cropped to 4:5 on large screens,
 * with a solid cream caption block beneath it. No overlay gradients, no
 * glassmorphism, no stock "handshake" imagery. The three facts are things the
 * product actually does today, taken from the Finance and Security screens.
 */

const PHOTO = {
  src: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5',
  alt: 'A cook working at a stove in a restaurant kitchen during service',
  credit: 'Photo: Jay Wennington / Unsplash',
}

const FACTS: Array<{ title: string; body: string }> = [
  {
    title: 'Settlement to your own bank account',
    body: 'Card payments are collected through Paystack and settle into your FoodBase balance on the platform schedule, then transfer to the bank account you verified by name.',
  },
  {
    title: 'Withdrawals protected by your PIN',
    body: 'Moving money out, and changing where it goes, both require the six-digit security PIN you set. No PIN, no payout.',
  },
  {
    title: 'Live the moment you publish',
    body: 'Your storefront sits at foodbase.ng/your-name. It stays unlisted until you add dishes, then customers can order straight away.',
  },
]

export function RegistrationPanel() {
  return (
    <aside className="flex min-w-0 flex-col">
      <figure className="min-w-0">
        <div className="relative w-full overflow-hidden rounded-[10px] bg-[var(--dash-surface-inset)] aspect-[16/10] lg:aspect-[4/5]">
          <Image
            src={PHOTO.src}
            alt={PHOTO.alt}
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
            style={{ objectPosition: '50% 40%' }}
          />
        </div>
        <figcaption className="mt-1.5 text-[10.5px] text-[var(--dash-ink-4)]">{PHOTO.credit}</figcaption>
      </figure>

      <div className="mt-5 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-brown)]">
          Built for the kitchen, not the boardroom
        </p>
        <h2 className="dash-display mt-2 text-[24px] leading-[1.15] text-[var(--dash-ink-1)] xl:text-[28px]">
          Run service, see the money, get paid.
        </h2>
        <p className="mt-2 max-w-[46ch] text-[13px] leading-[1.6] text-[var(--dash-ink-3)]">
          FoodBase is the ordering system for Nigerian restaurants. The same login covers the menu, the
          orders and the payout account.
        </p>

        <dl className="mt-4 divide-y divide-[var(--dash-line)] border-t border-[var(--dash-line)]">
          {FACTS.map((fact) => (
            <div key={fact.title} className="py-3.5">
              <dt className="text-[13px] font-semibold leading-5 text-[var(--dash-ink-1)]">{fact.title}</dt>
              <dd className="mt-1 max-w-[52ch] text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">{fact.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-[11.5px] leading-[1.5] text-[var(--dash-ink-4)]">
          Questions about fees?{' '}
          <Link
            href="/pricing"
            className="font-medium text-[var(--dash-brown)] underline-offset-4 hover:underline"
          >
            Read the pricing terms
          </Link>
          .
        </p>
      </div>
    </aside>
  )
}
