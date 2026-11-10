'use client'

import * as React from 'react'
import { CalendarDays, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { AdminRangeKey } from '@/lib/admin-period'
import { dateWat } from '@/components/admin/format'

export interface RangeState {
  range: AdminRangeKey
  from: string
  to: string
}

interface RangeContextValue extends RangeState {
  setRange: (range: AdminRangeKey) => void
  setCustom: (from: string, to: string) => void
  /** Query string for admin API calls, e.g. `range=30d`. */
  query: string
  label: string
}

const DEFAULT_STATE: RangeState = { range: '30d', from: '', to: '' }
const STORAGE_KEY = 'foodbase.admin.range'

const PRESETS: Array<{ key: AdminRangeKey; label: string; short: string }> = [
  { key: 'today', label: 'Today', short: 'Today' },
  { key: '7d', label: 'Last 7 days', short: '7 days' },
  { key: '30d', label: 'Last 30 days', short: '30 days' },
  { key: 'month', label: 'This month', short: 'Month' },
  { key: 'all', label: 'All time', short: 'All' },
]

function presetLabel(state: RangeState): string {
  if (state.range === 'custom' && state.from && state.to) {
    return `${dateWat(`${state.from}T12:00:00+01:00`)} – ${dateWat(`${state.to}T12:00:00+01:00`)}`
  }
  return PRESETS.find((preset) => preset.key === state.range)?.label ?? 'Last 30 days'
}

function toQuery(state: RangeState): string {
  const params = new URLSearchParams()
  params.set('range', state.range)
  if (state.range === 'custom') {
    if (state.from) params.set('from', state.from)
    if (state.to) params.set('to', state.to)
  }
  return params.toString()
}

const RangeContext = React.createContext<RangeContextValue | null>(null)

export function AdminRangeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<RangeState>(DEFAULT_STATE)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Partial<RangeState>
      const valid = PRESETS.some((preset) => preset.key === parsed.range) || parsed.range === 'custom'
      if (parsed.range && valid) {
        setState({
          range: parsed.range as AdminRangeKey,
          from: typeof parsed.from === 'string' ? parsed.from : '',
          to: typeof parsed.to === 'string' ? parsed.to : '',
        })
      }
    } catch {
      // Ignore malformed preferences and keep the default range.
    }
  }, [])

  const persist = React.useCallback((next: RangeState) => {
    setState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be unavailable (private mode); the in-memory range still works.
    }
  }, [])

  const value = React.useMemo<RangeContextValue>(
    () => ({
      ...state,
      setRange: (range) => {
        if (range === 'custom') {
          const today = new Date()
          const iso = (date: Date) => date.toISOString().slice(0, 10)
          const start = new Date(today.getTime() - 29 * 86_400_000)
          persist({ range, from: state.from || iso(start), to: state.to || iso(today) })
          return
        }
        persist({ range, from: '', to: '' })
      },
      setCustom: (from, to) => persist({ range: 'custom', from, to }),
      query: toQuery(state),
      label: presetLabel(state),
    }),
    [state, persist],
  )

  return (
    <RangeContext.Provider value={value}>
      <div className="admin-surface">{children}</div>
    </RangeContext.Provider>
  )
}

export function useAdminRange(): RangeContextValue {
  const context = React.useContext(RangeContext)
  if (!context) {
    throw new Error('useAdminRange must be used inside AdminRangeProvider')
  }
  return context
}

/** Global date-range control: segmented on desktop, native-friendly popover on mobile. */
export function RangeSelector({ className }: { className?: string }) {
  const { range, from, to, setRange, setCustom, label } = useAdminRange()
  const [open, setOpen] = React.useState(false)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="hidden items-center rounded-lg border border-border bg-card p-0.5 lg:flex" role="group" aria-label="Date range">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => setRange(preset.key)}
            aria-pressed={range === preset.key}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors',
              range === preset.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {preset.short}
          </button>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5 text-[12px] font-medium lg:h-8">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <span className={cn('max-w-[46vw] truncate', range === 'custom' && 'lg:max-w-none')}>{label}</span>
            <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[260px] p-2">
          <div className="grid gap-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setRange(preset.key)
                  setOpen(false)
                }}
                aria-pressed={range === preset.key}
                className={cn(
                  'flex min-h-9 items-center justify-between rounded-md px-2 text-[13px]',
                  range === preset.key ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
                )}
              >
                {preset.label}
                {range === preset.key ? <span className="text-[11px] text-muted-foreground">Selected</span> : null}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <p className="px-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-muted-foreground uppercase">Custom range</p>
            <div className="grid grid-cols-2 gap-2 px-1">
              <label className="grid gap-1 text-[11px] text-muted-foreground">
                From
                <Input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => setCustom(event.target.value, to)}
                  className="h-8 text-[12px]"
                />
              </label>
              <label className="grid gap-1 text-[11px] text-muted-foreground">
                To
                <Input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setCustom(from, event.target.value)}
                  className="h-8 text-[12px]"
                />
              </label>
            </div>
            <p className="px-2 pt-2 text-[11px] text-muted-foreground">Dates use West Africa Time (UTC+1).</p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
