'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Stepper } from '@/components/dashboard/stepper'
import { SectionCard } from '@/components/dashboard/layout'
import { Toggle, TimeInput } from '@/components/dashboard/toggle'
import { ErrorState, Skeleton } from '@/components/dashboard/empty-state'
import { StatusPill } from '@/components/dashboard/status-pill'
import { toast } from '@/components/dashboard/toast'
import { DAY_LABELS, isOpenAt, type DayHours } from '@/lib/hours-shared'

/**
 * Opening hours editor.
 *
 * One screen, three sections, and a Stepper that doubles as a progress read-out
 * and a way to jump to the section that still needs work. The "open now" chip is
 * computed locally from the values on screen, so it is a true preview before saving.
 */

type State = {
  days: DayHours[]
  acceptOrdersOutsideHours: boolean
  source: 'table' | 'availability' | 'empty'
  tableReady: boolean
}

const DEFAULT_OPEN = '09:00'
const DEFAULT_CLOSE = '21:00'

export function HoursEditor() {
  const router = useRouter()
  const [state, setState] = React.useState<State | null>(null)
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  const load = React.useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/business/hours', { credentials: 'include' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Failed')
      setState({
        days: Array.isArray(data.days) ? data.days : [],
        acceptOrdersOutsideHours: data.acceptOrdersOutsideHours !== false,
        source: data.source ?? 'empty',
        tableReady: Boolean(data.tableReady),
      })
      setDirty(false)
    } catch {
      setError('We could not load your opening hours. Check your connection and try again.')
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const updateDay = (dayOfWeek: number, patch: Partial<DayHours>) => {
    setState((current) =>
      current
        ? {
            ...current,
            days: current.days.map((day) => (day.day_of_week === dayOfWeek ? { ...day, ...patch } : day)),
          }
        : current,
    )
    setDirty(true)
  }

  const toggleDay = (day: DayHours, open: boolean) => {
    if (open) {
      updateDay(day.day_of_week, {
        is_closed: false,
        open_time: day.open_time ?? DEFAULT_OPEN,
        close_time: day.close_time ?? DEFAULT_CLOSE,
      })
    } else {
      updateDay(day.day_of_week, { is_closed: true })
    }
  }

  const copyMondayToAll = () => {
    if (!state) return
    const monday = state.days.find((day) => day.day_of_week === 1)
    if (!monday || monday.is_closed) {
      toast.info('Set Monday first', { description: 'Turn Monday on, then copy it to the rest of the week.' })
      return
    }
    setState({
      ...state,
      days: state.days.map((day) => ({
        ...day,
        is_closed: false,
        open_time: monday.open_time,
        close_time: monday.close_time,
      })),
    })
    setDirty(true)
    toast.success('Copied Monday to every day')
  }

  const openDays = state?.days.filter((day) => !day.is_closed) ?? []
  const incompleteDays = openDays.filter((day) => !day.open_time || !day.close_time)
  const step = openDays.length === 0 ? 0 : incompleteDays.length > 0 ? 1 : 2

  const now = React.useMemo(() => new Date(), [])
  const openNow = state ? isOpenAt(state.days, now) : false
  const todayRow = state?.days.find((day) => day.day_of_week === now.getDay())

  const save = async () => {
    if (!state || saving) return
    if (incompleteDays.length > 0) {
      toast.error('Some days are missing times', {
        description: `Add opening and closing times for ${incompleteDays.map((day) => DAY_LABELS[day.day_of_week]).join(', ')}.`,
      })
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/business/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: state.days,
          accept_orders_outside_hours: state.acceptOrdersOutsideHours,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast.error('Could not save', {
          description: typeof data?.error === 'string' ? data.error : 'Try again in a moment.',
        })
        return
      }
      setDirty(false)
      toast.success('Opening hours saved', {
        description: 'Your storefront now shows whether you are open or closed.',
      })
      router.refresh()
    } catch {
      toast.error('Could not save', { description: 'Check your connection and try again.' })
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return <ErrorState title="Opening hours did not load" description={error} onRetry={() => void load()} />
  }

  if (!state) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper
        steps={[
          { key: 'days', label: 'Days open', hint: `${openDays.length} of 7` },
          { key: 'times', label: 'Opening times', hint: incompleteDays.length > 0 ? 'Needs times' : 'Set' },
          { key: 'policy', label: 'Outside hours', hint: state.acceptOrdersOutsideHours ? 'Orders on' : 'Orders off' },
        ]}
        current={step}
        onSelect={(index) => {
          const target = ['hours-days', 'hours-times', 'hours-policy'][index]
          document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }}
      />

      {state.source === 'availability' ? (
        <p className="text-[12px] leading-[1.5] text-[var(--dash-ink-3)]">
          These hours came from the older availability settings. Saving them here moves the restaurant onto the
          per-day schedule.
        </p>
      ) : null}

      <SectionCard
        id="hours-days"
        title="Days you are open"
        description="Turn on the days you accept orders. Closed days show as closed on your storefront."
        action={
          <button
            type="button"
            onClick={copyMondayToAll}
            className="dash-tap inline-flex h-9 items-center rounded-[8px] border border-[var(--dash-line-strong)] px-3 text-[12px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)]"
          >
            Copy Monday to all
          </button>
        }
        padding="none"
      >
        <ul className="divide-y divide-[var(--dash-line)]">
          {state.days.map((day) => (
            <li key={day.day_of_week} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-[86px] shrink-0 text-[13px] font-medium text-[var(--dash-ink-1)]">
                  {DAY_LABELS[day.day_of_week]}
                </span>
                {!day.is_closed && day.open_time && day.close_time ? (
                  <span className="dash-num text-[12.5px] text-[var(--dash-ink-3)]">
                    {day.open_time} – {day.close_time}
                  </span>
                ) : (
                  <span className="text-[12.5px] text-[var(--dash-ink-4)]">Closed</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!day.is_closed}
                  aria-label={`${DAY_LABELS[day.day_of_week]} open`}
                  onClick={() => toggleDay(day, day.is_closed)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 ${
                    day.is_closed
                      ? 'border-[var(--dash-line-strong)] bg-[var(--dash-surface-inset)]'
                      : 'border-[var(--dash-brown)] bg-[var(--dash-brown)]'
                  }`}
                >
                  <span
                    className={`block size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                      day.is_closed ? 'translate-x-[4px]' : 'translate-x-[24px]'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        id="hours-times"
        title="Opening times"
        description="24-hour clock. A closing time earlier than the opening time means service runs past midnight."
      >
        <div className="flex flex-col gap-3">
          {state.days.map((day) => (
            <div
              key={day.day_of_week}
              className="grid grid-cols-[86px_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 border-b border-[var(--dash-line)] pb-3 last:border-0 last:pb-0 sm:gap-3"
            >
              <span className="pb-2.5 text-[13px] font-medium text-[var(--dash-ink-1)]">
                {DAY_LABELS[day.day_of_week].slice(0, 3)}
              </span>
              <TimeInput
                id={`open-${day.day_of_week}`}
                label="Opens"
                value={day.open_time ?? ''}
                disabled={day.is_closed}
                onChange={(value) => updateDay(day.day_of_week, { open_time: value || null })}
              />
              <TimeInput
                id={`close-${day.day_of_week}`}
                label="Closes"
                value={day.close_time ?? ''}
                disabled={day.is_closed}
                onChange={(value) => updateDay(day.day_of_week, { close_time: value || null })}
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="hours-policy" title="Orders outside opening hours">
        <div className="flex flex-col gap-3">
          <Toggle
            id="accept-outside"
            checked={state.acceptOrdersOutsideHours}
            onChange={(next) => {
              setState({ ...state, acceptOrdersOutsideHours: next })
              setDirty(true)
            }}
            label="Keep accepting orders when we are closed"
            description="On by default. Customers can still order and pay, and the order waits on your board until you open. Turn this off only if you would rather refuse orders while closed."
          />
          <div className="flex flex-wrap items-center gap-2 rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface-sunken)] px-3 py-2.5">
            <span className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">
              Right now
            </span>
            <StatusPill tone={openNow ? 'success' : 'neutral'}>
              {openNow ? 'Open' : 'Closed'}
            </StatusPill>
            <span className="text-[12px] text-[var(--dash-ink-3)]">
              {todayRow && !todayRow.is_closed && todayRow.open_time
                ? `Today ${todayRow.open_time} – ${todayRow.close_time ?? '—'}`
                : 'No hours set for today'}
              {!state.acceptOrdersOutsideHours && !openNow ? ' · orders paused until you open' : ''}
            </span>
          </div>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 -mx-4 border-t border-[var(--dash-line)] bg-[var(--dash-cream)]/95 px-4 py-3 backdrop-blur-[2px] sm:mx-0 sm:rounded-[10px] sm:border sm:px-4 dash-safe-bottom">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--dash-ink-3)]">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty}
            className="dash-tap inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[var(--dash-brown)] px-4 text-[13px] font-semibold text-white hover:bg-[var(--dash-brown-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? 'Saving…' : 'Save opening hours'}
          </button>
        </div>
      </div>
    </div>
  )
}
