import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/dashboard';
import { TableLabelsManager } from '@/components/dashboard/tables/table-labels-manager';
import './qr-print.css';

export const metadata: Metadata = {
  title: 'Table labels — FoodBase',
  description:
    'Name your tables, print QR cards, and send dine-in orders to the right table.',
};

export const dynamic = 'force-dynamic';

export default function TableLabelsPage() {
  return (
    <div className="dash-surface">
      <PageContainer>
        <PageHeader
          eyebrow="Storefront"
          title="Tables"
          description="Label the tables in your restaurant. Dine-in customers pick one at checkout, and every order, receipt and notification carries it."
        />
        <div className="mt-6">
          <TableLabelsManager />
        </div>
      </PageContainer>
    </div>
  );
}
