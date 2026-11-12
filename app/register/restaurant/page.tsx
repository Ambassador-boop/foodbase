import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { RegistrationForm } from '@/components/registration/registration-form'

export const metadata: Metadata = {
  title: 'Register your restaurant — FoodBase',
  description:
    'Create a FoodBase account for your restaurant. Add your menu, take orders and get paid to your own bank account. Accounts are active immediately.',
  alternates: { canonical: 'https://foodbase.ng/register/restaurant' },
  openGraph: {
    title: 'Register your restaurant — FoodBase',
    description:
      'Create a FoodBase account for your restaurant. Add your menu, take orders and get paid to your own bank account.',
    url: 'https://foodbase.ng/register/restaurant',
    siteName: 'FoodBase',
    locale: 'en_NG',
    type: 'website',
  },
}

export default function RegisterRestaurantPage() {
  return (
    <div className="dash-surface min-h-screen bg-[var(--dash-cream)]">
      {/* Utility bar. No nav menu: this page has exactly two exits. */}
      <header className="border-b border-[var(--dash-line)] bg-[var(--dash-cream)]/95 backdrop-blur-[2px]">
        <div className="mx-auto flex min-h-[56px] max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="FoodBase home">
            <Image src="/foodbase-logo.png" alt="" width={26} height={26} />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--dash-ink-1)]">FoodBase</span>
            <span className="hidden text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--dash-ink-4)] sm:inline">
              for restaurants
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="dash-tap inline-flex min-h-[36px] items-center rounded-[6px] px-2 text-[12.5px] font-medium text-[var(--dash-ink-2)] hover:text-[var(--dash-brown)]"
            >
              Sign in
            </Link>
            <Link
              href="/pricing"
              className="dash-tap hidden min-h-[36px] items-center rounded-[6px] border border-[var(--dash-line-strong)] px-3 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)] sm:inline-flex"
            >
              Pricing
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12 dash-safe-bottom">
        {/* Editorial intro: left aligned, one strong line, no centered hero. */}
        <div className="mb-8 max-w-[720px] lg:mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--dash-brown)]">
            Open an account
          </p>
          <h1 className="dash-display mt-2 text-[32px] leading-[1.08] tracking-[-0.02em] text-[var(--dash-ink-1)] sm:text-[42px] lg:text-[46px]">
            Put your kitchen online by tonight.
          </h1>
          <p className="mt-3 max-w-[58ch] text-[14px] leading-[1.6] text-[var(--dash-ink-3)]">
            One account for the menu, the orders and the money. Registration takes about two minutes and the
            storefront is live immediately. You can leave and come back at any step.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-[var(--dash-ink-3)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[var(--dash-success)]" aria-hidden="true" />
              No approval queue
            </span>
            <span className="hidden text-[var(--dash-line-strong)] sm:inline" aria-hidden="true">
              |
            </span>
            <span>Paystack settlement to your bank</span>
            <span className="hidden text-[var(--dash-line-strong)] sm:inline" aria-hidden="true">
              |
            </span>
            <span>PIN-protected payouts</span>
          </div>
        </div>

        <RegistrationForm />
      </main>

      <footer className="border-t border-[var(--dash-line)] bg-[var(--dash-cream)]">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-4 py-6 text-[11.5px] text-[var(--dash-ink-4)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} FoodBase, in conjunction with Wisdom Technologies.</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/terms" className="hover:text-[var(--dash-brown)]">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--dash-brown)]">
              Privacy
            </Link>
            <Link href="/refund-policy" className="hover:text-[var(--dash-brown)]">
              Refund policy
            </Link>
            <Link href="/cancellation-policy" className="hover:text-[var(--dash-brown)]">
              Cancellation policy
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
