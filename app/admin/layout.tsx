'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X, LogOut, BarChart3, Building2, DollarSign, Users, Settings, TrendingUp, Receipt, Bell } from 'lucide-react'

const navigationItems = [
  { label: 'Dashboard', href: '/admin', icon: BarChart3 }, { label: 'Businesses', href: '/admin/businesses', icon: Building2 },
  { label: 'Performance', href: '/admin/businesses/performance', icon: TrendingUp }, { label: 'Revenue', href: '/admin/revenue', icon: TrendingUp },
  { label: 'Transactions', href: '/admin/transactions', icon: Receipt }, { label: 'Withdrawals', href: '/admin/withdrawals', icon: DollarSign },
  { label: 'Alerts', href: '/admin/attention', icon: Bell }, { label: 'Users', href: '/admin/users', icon: Users }, { label: 'Settings', href: '/admin/settings', icon: Settings }, { label: 'Security', href: '/admin/security', icon: Settings },
]
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); const [attention, setAttention] = useState(0); const router = useRouter(); const pathname = usePathname()
  useEffect(() => { fetch('/api/admin/overview').then(r => r.ok ? r.json() : null).then(d => setAttention(Number(d?.attention || d?.overview?.attention || 0))).catch(() => {}) }, [])
  const logout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }
  return <div className="flex min-h-screen bg-background"><div className={sidebarOpen ? 'fixed inset-0 z-40 bg-black/30 lg:hidden' : 'hidden'} onClick={() => setSidebarOpen(false)} />
    <aside className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r bg-card p-3 transition-transform lg:relative lg:z-0 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex items-center justify-between border-b px-2 pb-4"><Link href="/" className="flex items-center gap-2"><Image src="/foodbase-logo.png" alt="FoodBase" width={28} height={28}/><span className="font-bold text-sm text-primary">FoodBase</span></Link><button className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X /></button></div><nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4">{navigationItems.map(item => { const Icon = item.icon; const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${active ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-4"/><span className="flex-1">{item.label}</span>{item.href === '/admin/attention' && attention > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{attention}</span>}</Link>})}</nav><Button variant="outline" size="sm" onClick={logout} className="justify-start gap-2 rounded-xl"><LogOut/>Logout</Button></aside>
    <div className="flex min-w-0 flex-1 flex-col"><header className="flex items-center justify-between border-b bg-card p-4 lg:justify-end"><button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu/></button><div className="text-right"><p className="text-sm font-semibold">Platform Admin</p><p className="text-[13px] text-muted-foreground">Overseeing FoodBase</p></div></header><main className="min-w-0 flex-1 overflow-auto"><div className="mx-auto w-full max-w-7xl p-4 lg:p-6">{children}</div></main></div></div>
}
