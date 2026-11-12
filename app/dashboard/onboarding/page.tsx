import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock3, ExternalLink, ShieldCheck, Utensils } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/active-business'
import { buildOnboarding } from '@/lib/onboarding'
import { PageContainer, PageHeader, SectionCard, SplitLayout, KeyValueList, InsetPanel } from '@/components/dashboard'
import { OnboardingChecklist } from '@/components/dashboard/onboarding-checklist'

export const metadata: Metadata = {
  title: 'Setup checklist — FoodBase',
  description: 'Finish the steps that make your restaurant take orders.',
}

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const business = await getActiveBusiness()
  if (!business) {
    return (
      <div className="dash-surface">
        <PageContainer>
          <PageHeader
            eyebrow="Setup"
            title="No restaurant on this account yet"
            description="This account is not linked to a restaurant. Register one, or ask your administrator to link it."
          />
          <div className="mt-5">
            <Link
              href="/register/restaurant"
              className="dash-tap inline-flex h-10 items-center rounded-[8px] bg-[var(--dash-brown)] px-4 text-[12.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)]"
            >
              Register a restaurant
            </Link>
          </div>
        </PageContainer>
      </div>
    )
  }

  const summary = await buildOnboarding(business, String(user.id))
  const storefrontUrl = business.slug ? `/${business.slug}` : null
  const profileDone = summary.steps.find((step) => step.key === 'profile')?.status === 'done'

  return (
    <div className="dash-surface">
      <PageContainer>
        <PageHeader
          eyebrow="Setup"
          title={summary.progress.complete ? `${business.name} is taking orders` : `Finish setting up ${business.name}`}
          description={
            summary.progress.complete
              ? 'Every step that matters is done. The remaining items below ship in a later release and will appear here when they land.'
              : 'Five short steps, calculated from what is actually saved on your restaurant. Nothing here blocks the dashboard, and you can leave and come back.'
          }
          meta={
            <>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {summary.progress.complete ? 'Under a minute to review' : 'About 12 minutes in total'}
              </span>
              <span className="text-[var(--dash-line-strong)]" aria-hidden="true">
                |
              </span>
              <span>{summary.progress.locked} step(s) coming in a later release</span>
            </>
          }
          actions={
            storefrontUrl ? (
              <Link
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="dash-tap inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-3.5 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
              >
                View storefront
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null
          }
        />

        <div className="mt-6">
          <SplitLayout
            sideWidth={320}
            main={<OnboardingChecklist initial={summary} businessName={business.name} storefrontUrl={storefrontUrl} />}
            side={
              <div className="flex flex-col gap-4">
                <SectionCard title="What is already saved" description="Read from your restaurant record just now.">
                  <KeyValueList
                    items={[
                      {
                        label: 'Storefront',
                        value: business.slug ? (
                          <Link
                            href={`/${business.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--dash-brown)] underline-offset-4 hover:underline"
                          >
                            foodbase.ng/{business.slug}
                          </Link>
                        ) : (
                          'Not set'
                        ),
                      },
                      {
                        label: 'Profile',
                        value: profileDone ? 'Name, logo and description saved' : 'Incomplete',
                        hint: profileDone ? undefined : 'Customers see this first.',
                      },
                      {
                        label: 'Visibility',
                        value: business.is_active ? 'Active' : 'Suspended',
                        hint: business.is_active ? undefined : 'Contact support to reactivate.',
                      },
                    ]}
                  />
                </SectionCard>

                <SectionCard title="Why this order" padding="tight">
                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex items-start gap-2.5">
                      <Utensils className="mt-0.5 size-4 shrink-0 text-[var(--dash-brown)]" aria-hidden="true" />
                      <p className="text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">
                        Menu and payout details come first because nothing can be sold or paid out without them.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--dash-brown)]" aria-hidden="true" />
                      <p className="text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">
                        The PIN protects your money, not your data. Set it before your first withdrawal, not after.
                      </p>
                    </div>
                  </div>
                </SectionCard>

                <InsetPanel>
                  <p className="text-[12.5px] font-semibold text-[var(--dash-ink-1)]">Stuck on a step?</p>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[var(--dash-ink-3)]">
                    Reply to your welcome email and a person will answer. Include your storefront address so we can
                    look at the right account.
                  </p>
                </InsetPanel>
              </div>
            }
          />
        </div>
      </PageContainer>
    </div>
  )
}
