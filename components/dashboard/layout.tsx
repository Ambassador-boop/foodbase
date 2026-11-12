import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rhythm } from '@/components/dashboard/tokens'

/**
 * Layout helpers for the dashboard design system.
 *
 * These are deliberately server-safe (no hooks) so pages can stay server
 * components and only push interactivity into leaves.
 */

/** Wraps a screen in the dashboard type + focus treatment without touching global styles. */
export function DashSurface({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('dash-surface', className)}>{children}</div>
}

/** The single content column. Caps the measure so text does not run to 1600px. */
export function PageContainer({
  children,
  className,
  width = 'default',
}: {
  children: React.ReactNode
  className?: string
  width?: 'default' | 'wide' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0',
        width === 'wide' && 'max-w-[1400px]',
        width === 'narrow' && 'max-w-[720px]',
        width === 'default' && 'max-w-[1320px]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Page header. Eyebrow is optional and used sparingly (a section name, not a
 * greeting). Title is set in the editorial serif; body copy stays in the UI face.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  meta,
  actions,
  backHref,
  backLabel,
  className,
}: {
  title: string
  eyebrow?: string
  description?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
  className?: string
}) {
  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="dash-tap mb-2 inline-flex min-h-[28px] items-center gap-1 text-[12px] font-medium text-[var(--dash-ink-3)] hover:text-[var(--dash-brown)]"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            {backLabel ?? 'Back'}
          </Link>
        ) : null}
        {eyebrow ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-brown)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="dash-display text-[28px] leading-[1.12] text-[var(--dash-ink-1)] sm:text-[34px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.55] text-[var(--dash-ink-3)] sm:text-[14px]">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--dash-ink-3)]">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/**
 * A section of a page. Hairline border and a flat surface: no drop shadow, no
 * oversized corner radius, no gradient. `divided` draws the header rule.
 */
export function SectionCard({
  title,
  description,
  eyebrow,
  action,
  footer,
  children,
  className,
  bodyClassName,
  padding = 'default',
  as: Tag = 'section',
  id,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  eyebrow?: string
  action?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  padding?: 'none' | 'default' | 'tight'
  as?: 'section' | 'article' | 'div' | 'aside'
  id?: string
}) {
  const hasHeader = Boolean(title || description || eyebrow || action)
  return (
    <Tag
      id={id}
      className={cn(
        'flex min-w-0 flex-col rounded-[10px] border border-[var(--dash-line)] bg-[var(--dash-surface)]',
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--dash-line)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--dash-ink-4)]">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="text-[14px] font-semibold leading-5 text-[var(--dash-ink-1)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 max-w-[70ch] text-[12.5px] leading-[1.5] text-[var(--dash-ink-3)]">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div
        className={cn(
          'min-w-0 flex-1',
          padding === 'default' && 'px-4 py-4 sm:px-5',
          padding === 'tight' && 'px-4 py-2.5 sm:px-5',
          padding === 'none' && '',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="border-t border-[var(--dash-line)] bg-[var(--dash-surface-sunken)] px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </Tag>
  )
}

/** A quieter block inside a card. Used for "what happens next" notes and empty slots. */
export function InsetPanel({
  children,
  className,
  tone = 'sand',
}: {
  children: React.ReactNode
  className?: string
  tone?: 'sand' | 'plain'
}) {
  return (
    <div
      className={cn(
        'rounded-[8px] border px-4 py-3',
        tone === 'sand'
          ? 'border-[var(--dash-sand-deep)] bg-[var(--dash-surface-inset)]'
          : 'border-[var(--dash-line)] bg-[var(--dash-surface-sunken)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Vertical stack with the 4/8 rhythm baked in. */
export function Stack({
  children,
  className,
  gap = 'default',
  as: Tag = 'div',
}: {
  children: React.ReactNode
  className?: string
  gap?: 'tight' | 'default' | 'loose'
  as?: 'div' | 'ul' | 'ol'
}) {
  return (
    <Tag
      className={cn(
        'flex flex-col',
        gap === 'tight' && rhythm.stackTight,
        gap === 'default' && rhythm.stack,
        gap === 'loose' && rhythm.stackLoose,
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/** Horizontal row that wraps instead of overflowing at 360px. */
export function Row({
  children,
  className,
  gap = 'default',
  align = 'center',
  justify = 'start',
}: {
  children: React.ReactNode
  className?: string
  gap?: 'tight' | 'default' | 'loose'
  align?: 'start' | 'center' | 'end' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'between'
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap',
        gap === 'tight' && 'gap-2',
        gap === 'default' && 'gap-3',
        gap === 'loose' && 'gap-4',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
        align === 'baseline' && 'items-baseline',
        justify === 'start' && 'justify-start',
        justify === 'center' && 'justify-center',
        justify === 'end' && 'justify-end',
        justify === 'between' && 'justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Two-column split. The side column drops below the main column at mobile widths
 * and is pinned at 1024px and up. The rule lives in app/globals.css so no client
 * JS or per-instance <style> tag is needed.
 */
export function SplitLayout({
  main,
  side,
  sideWidth = 320,
  className,
  sideFirst = false,
}: {
  main: React.ReactNode
  side: React.ReactNode
  sideWidth?: 280 | 320 | 360
  className?: string
  sideFirst?: boolean
}) {
  return (
    <div
      className={cn('dash-split grid min-w-0 items-start gap-4 lg:gap-6', className)}
      style={{ ['--dash-split-side' as string]: `${sideWidth}px` }}
    >
      <div className={cn('order-1 min-w-0', sideFirst && 'lg:order-2')}>{main}</div>
      <div className={cn('order-2 min-w-0', sideFirst && 'lg:order-1')}>{side}</div>
    </div>
  )
}

/** A 2/3/4-up tile grid that never forces horizontal scroll. */
export function StatGrid({
  children,
  className,
  min = 160,
}: {
  children: React.ReactNode
  className?: string
  min?: number
}) {
  return (
    <div
      className={cn('grid min-w-0 gap-3', className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))` }}
    >
      {children}
    </div>
  )
}

/** Hairline divider with optional label. */
export function Rule({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-0 border-t border-[var(--dash-line)]', className)} />
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-px flex-1 bg-[var(--dash-line)]" aria-hidden="true" />
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--dash-ink-4)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--dash-line)]" aria-hidden="true" />
    </div>
  )
}

/** Definition list used for read-only detail blocks. */
export function KeyValueList({
  items,
  className,
  columns = 1,
}: {
  items: Array<{ label: string; value: React.ReactNode; hint?: React.ReactNode }>
  className?: string
  columns?: 1 | 2
}) {
  return (
    <dl
      className={cn(
        'grid min-w-0 gap-x-6 gap-y-3',
        columns === 2 && 'sm:grid-cols-2',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--dash-ink-4)]">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-[13px] leading-5 text-[var(--dash-ink-1)]">{item.value}</dd>
          {item.hint ? (
            <p className="mt-0.5 text-[11.5px] leading-4 text-[var(--dash-ink-3)]">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  )
}
