'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  LayoutDashboard,
  MessageSquare,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { AdminRangeProvider, RangeSelector } from '@/components/admin/range'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }] },
  {
    label: 'Money',
    items: [
      { label: 'Revenue', href: '/admin/revenue', icon: TrendingUp },
      { label: 'Fee transactions', href: '/admin/revenue/transactions', icon: ReceiptText },
      { label: 'Transactions', href: '/admin/transactions', icon: ReceiptText },
      { label: 'Withdrawals', href: '/admin/withdrawals', icon: Wallet },
    ],
  },
  {
    label: 'Businesses',
    items: [
      { label: 'Businesses', href: '/admin/businesses', icon: Store },
      { label: 'New registrations', href: '/admin/businesses/registrations', icon: UserPlus },
      { label: 'Performance', href: '/admin/businesses/performance', icon: TrendingUp },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Alerts', href: '/admin/attention', icon: Bell, badge: true },
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'SMS wallet', href: '/admin/sms', icon: MessageSquare },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
      { label: 'Security', href: '/admin/security', icon: ShieldCheck },
    ],
  },
]

const PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/admin/revenue/transactions', title: 'Fee transactions' },
  { prefix: '/admin/revenue/withdraw', title: 'Withdraw revenue' },
  { prefix: '/admin/revenue', title: 'Revenue' },
  { prefix: '/admin/transactions', title: 'Transactions' },
  { prefix: '/admin/withdrawals', title: 'Withdrawals' },
  { prefix: '/admin/businesses/registrations', title: 'New registrations' },
  { prefix: '/admin/businesses/performance', title: 'Business performance' },
  { prefix: '/admin/businesses/register', title: 'Add business' },
  { prefix: '/admin/businesses/edit', title: 'Edit business' },
  { prefix: '/admin/businesses', title: 'Businesses' },
  { prefix: '/admin/attention', title: 'Alerts' },
  { prefix: '/admin/users/new', title: 'Add user' },
  { prefix: '/admin/users/edit', title: 'Edit user' },
  { prefix: '/admin/users', title: 'Users' },
  { prefix: '/admin/sms', title: 'SMS wallet' },
  { prefix: '/admin/settings', title: 'Settings' },
  { prefix: '/admin/security', title: 'Security' },
  { prefix: '/admin', title: 'Dashboard' },
]

function pageTitle(pathname: string): string {
  return PAGE_TITLES.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))?.title ?? 'Admin'
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLinks({ pathname, attention, onNavigate }: { pathname: string; attention: number; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3" aria-label="Admin sections">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                      active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.75} aria-hidden="true" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && attention > 0 ? (
                      <span className="num min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-semibold text-primary-foreground">
                        {attention > 99 ? '99+' : attention}
                      </span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/admin'
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [attention, setAttention] = React.useState(0)
  const [admin, setAdmin] = React.useState<{ name: string; email: string | null } | null>(null)
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [attentionResponse, meResponse] = await Promise.all([
          fetch('/api/admin/attention?countsOnly=1', { credentials: 'include' }),
          fetch('/api/admin/me', { credentials: 'include' }),
        ])
        if (attentionResponse.ok) {
          const data = await attentionResponse.json()
          if (!cancelled) setAttention(Number(data?.total ?? 0))
        }
        if (meResponse.ok) {
          const data = await meResponse.json()
          if (!cancelled) setAdmin({ name: data?.name || 'Platform admin', email: data?.email ?? null })
        }
      } catch {
        // The shell stays usable without the badge and profile.
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [pathname])

  const logout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.push('/login')
    }
  }

  const title = pageTitle(pathname)
  const initials = (admin?.name || 'Platform admin')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <AdminRangeProvider>
      <div className="min-h-screen bg-background">
        <a
          href="#admin-main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:shadow"
        >
          Skip to content
        </a>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-14 items-center gap-2 border-b border-border px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <Image src="/foodbase-logo.png" alt="" width={26} height={26} className="rounded-md" />
              <span className="text-[14px] font-semibold tracking-[-0.01em] text-primary">FoodBase</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Admin</span>
            </Link>
          </div>
          <NavLinks pathname={pathname} attention={attention} />
          <div className="border-t border-border p-2">
            <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                {initials || 'PA'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-foreground">{admin?.name || 'Platform admin'}</p>
                <p className="truncate text-[11px] text-muted-foreground">{admin?.email || 'Signed in'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              disabled={loggingOut}
              className="mt-1 h-9 w-full justify-start gap-2 text-[12px] text-muted-foreground"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              {loggingOut ? 'Signing out…' : 'Log out'}
            </Button>
          </div>
        </aside>

        <div className="lg:pl-[236px]">
          <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <div className="flex min-h-14 items-center gap-2 px-3 sm:px-5">
              <Button
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{title}</p>
                <p className="hidden text-[11px] text-muted-foreground sm:block">FoodBase platform operations</p>
              </div>
              <RangeSelector />
              <div className="ml-1 hidden items-center gap-2 border-l border-border pl-3 md:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                  {initials || 'PA'}
                </span>
                <div className="hidden lg:block">
                  <p className="max-w-[140px] truncate text-[12px] font-medium text-foreground">{admin?.name || 'Platform admin'}</p>
                  <p className="max-w-[140px] truncate text-[11px] text-muted-foreground">{admin?.email || ''}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} disabled={loggingOut} aria-label="Log out" className="size-8">
                  <LogOut className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </header>

          <main id="admin-main" className="mx-auto w-full max-w-[1240px] px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
            {children}
          </main>
        </div>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="flex w-[280px] flex-col gap-0 p-0">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <SheetTitle className="flex items-center gap-2 text-[14px] font-semibold text-primary">
                <Image src="/foodbase-logo.png" alt="" width={24} height={24} className="rounded-md" />
                FoodBase
              </SheetTitle>
              <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="size-9">
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <NavLinks pathname={pathname} attention={attention} onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                  {initials || 'PA'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium">{admin?.name || 'Platform admin'}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{admin?.email || ''}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={logout} disabled={loggingOut} className="h-10 w-full gap-2">
                <LogOut className="size-4" aria-hidden="true" />
                {loggingOut ? 'Signing out…' : 'Log out'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminRangeProvider>
  )
}
