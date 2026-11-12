'use client';

import Link from 'next/link';
import {
  User,
  Building2,
  Landmark,
  Users,
  Lock,
  Bell,
  BellRing,
  CreditCard,
  ChevronRight,
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'coming-soon';
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile',
    description: 'View and edit your personal information',
    icon: User,
    href: '/dashboard/profile',
  },
  {
    id: 'businesses',
    title: 'Businesses',
    description: 'Manage your business accounts',
    icon: Building2,
    href: '/dashboard/profile/businesses',
  },
  {
    id: 'bank-details',
    title: 'Bank & Payouts',
    description: 'Manage your bank account for withdrawals',
    icon: Landmark,
    href: '/dashboard/profile/bank-details',
  },
  {
    id: 'team',
    title: 'Team & Sharing',
    description: 'Manage team members and permissions',
    icon: Users,
    href: '/dashboard/teams',
    badge: 'Coming soon',
    badgeVariant: 'coming-soon',
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Password, 2FA, and authentication settings',
    icon: Lock,
    href: '/dashboard/security',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Manage your notification preferences',
    icon: Bell,
    href: '/dashboard/notifications',
    badge: 'Coming soon',
    badgeVariant: 'coming-soon',
  },
  {
    id: 'push-alerts',
    title: 'Push alerts',
    description: 'Register this device, send a test alert, and set the paid-order sound',
    icon: BellRing,
    href: '/dashboard/settings/notifications',
  },
  {
    id: 'billing',
    title: 'Billing / Subscription',
    description: 'View billing and subscription',
    icon: CreditCard,
    href: '/dashboard/billing',
    badge: 'Coming soon',
    badgeVariant: 'coming-soon',
  },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your account, security, and preferences
          </p>
        </div>

        {/* Settings Grid */}
        <div className="grid gap-4">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const isDisabled = section.badgeVariant === 'coming-soon';

            return isDisabled ? (
              <div
                key={section.id}
                className="relative p-6 rounded-lg border border-border bg-muted/20 cursor-not-allowed opacity-60"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-lg bg-primary/5 text-primary">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {section.badge && (
                      <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        {section.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <Link
                key={section.id}
                href={section.href}
                className="group relative p-6 rounded-lg border border-border bg-white hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 rounded-lg bg-primary/5 group-hover:bg-primary/10 text-primary transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors duration-200">
                        {section.title}
                      </h3>
                      <p className="text-sm text-muted-foreground group-hover:text-muted-foreground transition-colors duration-200">
                        {section.description}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 ml-4 flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
