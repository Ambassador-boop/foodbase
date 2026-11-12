import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/dashboard';
import { NotificationSettingsPanel } from '@/components/dashboard/notification-settings-panel';

export const metadata: Metadata = {
  title: 'Notification settings — FoodBase',
  description: 'Register this device for push, send a test alert, and set the paid-order sound.',
};

export const dynamic = 'force-dynamic';

export default function NotificationSettingsPage() {
  return (
    <div className="dash-surface">
      <PageContainer>
        <PageHeader
          eyebrow="Settings"
          title="Notifications"
          description="Paid orders reach this device once, at the moment payment clears. Register the device, send a test, and decide how loud it should be."
          backHref="/dashboard/settings"
          backLabel="Settings"
        />
        <div className="mt-6">
          <NotificationSettingsPanel />
        </div>
      </PageContainer>
    </div>
  );
}
