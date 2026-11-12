import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getActiveBusiness } from '@/lib/active-business';
import { KitchenBoard } from '@/components/dashboard/kitchen/kitchen-board';
import './kitchen.css';

export const metadata: Metadata = {
  title: 'Kitchen — FoodBase',
  description:
    'The kitchen pass: paid orders only, from new to preparing to ready, with a sound when an order lands.',
};

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const business = await getActiveBusiness();
  if (!business) redirect('/login');

  return <KitchenBoard businessName={business.name} />;
}
