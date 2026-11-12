import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/dashboard';
import { DeliveryManager } from '@/components/dashboard/delivery/delivery-manager';

export const metadata: Metadata = {
  title: 'Delivery areas — FoodBase',
  description:
    'Set the areas you deliver to and the fee for each one. Fees are calculated from the customer pin at checkout.',
};

export const dynamic = 'force-dynamic';

export default function DeliveryAreasPage() {
  return (
    <div className="dash-surface">
      <PageContainer>
        <PageHeader
          eyebrow="Storefront"
          title="Delivery areas"
          description="Draw where you deliver, price each area, and let checkout work out the fee before the customer pays."
        />
        <div className="mt-6">
          <DeliveryManager />
        </div>
      </PageContainer>
    </div>
  );
}
