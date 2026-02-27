'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, BarChart3, Utensils, Plus, Droplet, FolderOpen, Zap, ShoppingCart, DollarSign, Share2 } from 'lucide-react';

const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { label: 'Menu Items', href: '/dashboard/menu', icon: Utensils },
  { label: 'Add-ons', href: '/dashboard/addons', icon: Plus },
  { label: 'Drinks', href: '/dashboard/drinks', icon: Droplet },
  { label: 'Categories', href: '/dashboard/categories', icon: FolderOpen },
  { label: 'Popular Dishes', href: '/dashboard/popular', icon: Zap },
  { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
  { label: 'Finance', href: '/dashboard/finance', icon: DollarSign },
  { label: 'Share Business', href: '/dashboard/share', icon: Share2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-56 bg-white border-r border-border z-50 lg:z-0 lg:relative transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Image
              src="/foodbase-logo.png"
              alt="FoodBase"
              width={28}
              height={28}
            />
            <span className="font-bold text-sm text-primary">FoodBase</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto block"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/5 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="w-full text-xs h-8 justify-start gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="border-b border-border bg-white p-4 flex items-center justify-between lg:justify-end">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <p className="font-semibold text-foreground">Business Owner</p>
              <p className="text-muted-foreground">Managing your restaurant</p>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
