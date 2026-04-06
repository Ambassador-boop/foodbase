'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, BarChart3, Utensils, Plus, Droplet, FolderOpen, Zap, ShoppingCart, DollarSign, Share2, ChevronDown } from 'lucide-react';
import NotificationsIcon from '@/components/dashboard/notifications-icon';

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

interface Business {
  id: string;
  name: string;
  slug: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [businessDropdownOpen, setBusinessDropdownOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUserBusinesses = async () => {
      try {
        const response = await fetch('/api/business');
        const data = await response.json();
        if (response.ok && data.businesses) {
          setBusinesses(data.businesses);
          // Set current business from localStorage or first business
          const savedBusinessId = localStorage.getItem('currentBusinessId');
          const current = data.businesses.find((b: Business) => b.id === savedBusinessId) || data.businesses[0];
          if (current) {
            setCurrentBusiness(current);
          }
        }
      } catch (error) {
        console.error('Failed to fetch businesses:', error);
      }
    };

    fetchUserBusinesses();
  }, []);

  const handleBusinessSwitch = (business: Business) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentBusiness(business);
      localStorage.setItem('currentBusinessId', business.id);
      setBusinessDropdownOpen(false);
      setIsAnimating(false);
    }, 150);
  };

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
        <div className="p-4 border-b border-border flex-shrink-0">
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

        {/* Business Switcher */}
        {businesses.length > 0 && currentBusiness && (
          <div className="px-3 py-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setBusinessDropdownOpen(!businessDropdownOpen)}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-between gap-2 border border-primary/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">{currentBusiness.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentBusiness.slug}</p>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 text-primary ${businessDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {businessDropdownOpen && businesses.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    {businesses.map((business, index) => (
                      <button
                        key={business.id}
                        onClick={() => handleBusinessSwitch(business)}
                        className={`w-full text-left px-3 py-2.5 text-xs transition-colors ${
                          business.id === currentBusiness.id
                            ? 'bg-primary text-white font-semibold'
                            : 'hover:bg-muted/30 text-foreground'
                        } ${index !== businesses.length - 1 ? 'border-b border-muted/20' : ''}`}
                      >
                        <span className="block truncate font-medium">{business.name}</span>
                        <span className="block text-xs opacity-75 truncate">{business.slug}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
          <div className="flex items-center gap-4">
            <Link href="/dashboard/analytics" className="p-2 hover:bg-muted rounded transition-colors" title="Go to analytics">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </Link>
            <NotificationsIcon />
            <div className="text-right text-xs">
              <p className="font-semibold text-foreground">Business Owner</p>
              {currentBusiness && (
                <p className="text-muted-foreground">Managing {currentBusiness.name}</p>
              )}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className={`flex-1 overflow-auto transition-all duration-300 ${isAnimating ? 'opacity-50 scale-98' : 'opacity-100 scale-100'}`}>
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
