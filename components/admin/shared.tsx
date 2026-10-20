'use client'

import Link from 'next/link'
import { StatCard, StatusBadge } from '@/components/finance'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/finance'

export const money = (value: unknown) => formatNaira(Number(value || 0))
export const wat = (value: string | undefined | null) => value ? `${new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}, ${new Date(value).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true })} WAT` : '—'
export const maskAccount = (value: string | undefined | null) => value ? `•••• ${value.slice(-4)}` : '—'
export function RangeChips({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="flex max-w-full gap-2 overflow-x-auto pb-1">{[['today','Today'],['7d','7 days'],['30d','30 days'],['month','This month'],['all','All time']].map(([key,label]) => <button key={key} onClick={() => onChange(key)} className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[13px]', value === key ? 'border-primary bg-accent text-primary' : 'border-border text-muted-foreground')}>{label}</button>)}</div> }
export function AdminCard({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) { return <Card className={cn('rounded-2xl p-4 sm:p-5', className)}>{title && <div className="mb-4"><h2 className="text-sm font-semibold">{title}</h2>{description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}</div>}{children}</Card> }
export function MetricRow({ label, value, negative = false }: { label: string; value: React.ReactNode; negative?: boolean }) { return <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0"><span className="text-[13px] text-muted-foreground">{label}</span><span className={cn('text-sm font-medium', negative && 'text-destructive')}>{negative && typeof value === 'string' && !value.startsWith('-') ? `-${value}` : value}</span></div> }
export { Link, Button, Input, StatCard, StatusBadge }
