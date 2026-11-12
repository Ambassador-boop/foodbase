import type { Metadata } from 'next'
import { PageContainer, PageHeader } from '@/components/dashboard'
import { HoursEditor } from '@/components/dashboard/hours-editor'

export const metadata: Metadata = {
  title: 'Opening hours — FoodBase',
  description: 'Set the days and times your restaurant is open. Shown on your storefront.',
}

export const dynamic = 'force-dynamic'

export default function OpeningHoursPage() {
  return (
    <div className="dash-surface">
      <PageContainer width="narrow">
        <PageHeader
          eyebrow="Storefront"
          title="Opening hours"
          description="Customers see open or closed at the top of your storefront, based on these times. Orders placed outside them still reach your board by default, so a late order is never lost."
        />
        <div className="mt-6">
          <HoursEditor />
        </div>
      </PageContainer>
    </div>
  )
}
