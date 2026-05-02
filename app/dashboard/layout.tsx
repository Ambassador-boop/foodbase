'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Menu,
  X,
  LogOut,
  BarChart3,
  Utensils,
  Plus,
  Droplet,
  FolderOpen,
  Zap,
  ShoppingCart,
  DollarSign,
  Share2,
  ChevronDown,
  User,
  Check,
} from 'lucide-react';
import NotificationsIcon from '@/components/dashboard/notifications-icon';
import BusinessSwitchOverlay from '@/components/dashboard/business-switch-overlay';
import { switchBusiness } from '@/lib/business-switch';

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
  { label: 'Profile', href: '/dashboard/profile', icon: User },
];

interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
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
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // List of all businesses owned by this user (with logos for animation)
        const allRes = await fetch('/api/user/businesses', { credentials: 'include' });
        const allData = await allRes.json();
        const list: Business[] = allData?.businesses || [];

        // Active business resolved server-side via cookie
        const activeRes = await fetch('/api/business', { credentials: 'include' });
        const activeData = await activeRes.json();
        const active: Business | null =
          activeData?.business ||
          (activeData?.businesses && activeData.businesses[0]) ||
          list[0] ||
          null;

        if (!cancelled) {
          setBusinesses(list);
          if (active) setCurrentBusiness(active as Business);
        }
      } catch (error) {
        console.error('Failed to fetch businesses:', error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
      const userAgent = navigator.userAgent || '';

        const isWebView =
            userAgent.includes('wv') &&
                userAgent.toLowerCase().includes('median');

                  if (!isWebView) return;

                    // ❌ Disable right click
                      const handleContextMenu = (e: MouseEvent) => e.preventDefault();

                        // ❌ Disable copy shortcuts
                          const handleKeyDown = (e: KeyboardEvent) => {
                              if (
                                    (e.ctrlKey || e.metaKey) &&
                                          ['c', 'x', 'u', 's', 'a'].includes(e.key.toLowerCase())
                                              ) {
                                                    e.preventDefault();
                                                        }
                                                          };

                                                            // ❌ Disable text selection via CSS
                                                              const style = document.createElement('style');
                                                                style.innerHTML = `
                                                                    * {
                                                                          user-select: none !important;
                                                                                -webkit-user-select: none !important;
                                                                                    }
                                                                                      `;
                                                                                        document.head.appendChild(style);

                                                                                          document.addEventListener('contextmenu', handleContextMenu);
                                                                                            document.addEventListener('keydown', handleKeyDown);

                                                                                              return () => {
                                                                                                  document.removeEventListener('contextmenu', handleContextMenu);
                                                                                                      document.removeEventListener('keydown', handleKeyDown);
                                                                                                        };
                                                                                                        }, []);

  // Click-outside to close dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setBusinessDropdownOpen(false);
      }
    }
    if (businessDropdownOpen) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [businessDropdownOpen]);

  const handleBusinessSwitch = async (business: Business) => {
    if (!currentBusiness || business.id === currentBusiness.id) {
      setBusinessDropdownOpen(false);
      return;
    }
    setBusinessDropdownOpen(false);
    try {
      await switchBusiness(currentBusiness, business);
    } catch (err) {
      console.error('[v0] Switch business failed:', err);
    }
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
        className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-border z-50 lg:z-0 lg:relative transform transition-transform lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border flex-shrink-0 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
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
            className="lg:hidden"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Business Switcher */}
        {businesses.length > 0 && currentBusiness && (
          <div className="px-3 py-3 border-b border-border flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Workspace
            </p>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setBusinessDropdownOpen(!businessDropdownOpen)}
                className="w-full text-left p-2.5 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 transition-all flex items-center gap-3 border border-primary/15"
                aria-expanded={businessDropdownOpen}
                aria-haspopup="listbox"
              >
                <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white ring-1 ring-border flex-shrink-0">
                  {currentBusiness.logo_url ? (
                    <Image
                      src={currentBusiness.logo_url}
                      alt={currentBusiness.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary font-bold text-sm">
                      {currentBusiness.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {currentBusiness.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {currentBusiness.slug}
                  </p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 text-primary ${
                    businessDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {businessDropdownOpen && businesses.length > 1 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-border rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3 py-2 border-b border-border bg-muted/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Switch business
                    </p>
                  </div>
                  <div
                    className="max-h-72 overflow-y-auto"
                    role="listbox"
                    aria-label="Your businesses"
                  >
                    {businesses.map((business) => {
                      const isActive = business.id === currentBusiness.id;
                      return (
                        <button
                          key={business.id}
                          onClick={() => handleBusinessSwitch(business)}
                          role="option"
                          aria-selected={isActive}
                          className={`w-full text-left px-3 py-2.5 text-xs transition-colors flex items-center gap-3 ${
                            isActive
                              ? 'bg-primary/5'
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className="relative w-8 h-8 rounded-md overflow-hidden bg-muted/50 ring-1 ring-border flex-shrink-0">
                            {business.logo_url ? (
                              <Image
                                src={business.logo_url}
                                alt={business.name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-primary font-bold text-xs">
                                {business.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate ${
                                isActive
                                  ? 'font-semibold text-primary'
                                  : 'font-medium text-foreground'
                              }`}
                            >
                              {business.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {business.slug}
                            </p>
                          </div>
                          {isActive && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
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
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/analytics"
              className="p-2 hover:bg-muted rounded transition-colors"
              title="Go to analytics"
            >
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </Link>
            <NotificationsIcon />
            <div className="text-right text-xs">
              <p className="font-semibold text-foreground">Business Owner</p>
              {currentBusiness && (
                <p className="text-muted-foreground">
                  Managing {currentBusiness.name}
                </p>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">{children}</div>
        </main>
      </div>

      {/* Global animated overlay for business switching */}
      <BusinessSwitchOverlay />
    </div>
  );
}
