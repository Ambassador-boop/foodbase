'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Table.
 *
 * Two densities, because two jobs: `comfortable` for the customer-facing and
 * admin reading tables (16 px rows, room to scan), `dense` for finance, where
 * the point is to see forty rows at once without scrolling. Both share the
 * same hairline rules and the same header treatment.
 *
 * Numeric columns are right-aligned and set in tabular figures by passing
 * `numeric` to TableHead and TableCell, so a column of naira amounts lines up
 * on the decimal point. Amounts stay in ink: colour is never used to say
 * "this number is bad".
 *
 * `sticky` on TableHeader pins the header inside the scroll container, which is
 * what a long ledger needs.
 */

type Density = 'comfortable' | 'dense'

const DensityContext = React.createContext<Density>('comfortable')

function Table({
  className,
  density = 'comfortable',
  ...props
}: React.ComponentProps<'table'> & { density?: Density }) {
  return (
    <DensityContext.Provider value={density}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <table
          data-slot="table"
          data-density={density}
          className={cn('w-full caption-bottom border-collapse type-small', className)}
          {...props}
        />
      </div>
    </DensityContext.Provider>
  )
}

function TableHeader({
  className,
  sticky = false,
  ...props
}: React.ComponentProps<'thead'> & { sticky?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      data-sticky={sticky ? '' : undefined}
      className={cn(
        '[&_tr]:border-b [&_tr]:border-line',
        sticky && 'sticky top-0 z-10 bg-card',
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-line bg-brand-50 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  ...props
}: React.ComponentProps<'tr'> & { selected?: boolean }) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-line transition-colors duration-[120ms] ease-brand',
        'hover:bg-brand-50/60 data-[state=selected]:bg-brand-50',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<'th'> & { numeric?: boolean }) {
  const density = React.useContext(DensityContext)
  return (
    <th
      data-slot="table-head"
      className={cn(
        'align-middle font-medium whitespace-nowrap text-ink-muted',
        'type-caption tracking-wide uppercase',
        density === 'dense' ? 'h-9 px-2' : 'h-11 px-3',
        numeric ? 'text-right tnum' : 'text-left',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<'td'> & { numeric?: boolean }) {
  const density = React.useContext(DensityContext)
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'align-middle whitespace-nowrap text-ink',
        density === 'dense' ? 'px-2 py-1.5' : 'px-3 py-3',
        numeric ? 'text-right tnum' : 'text-left',
        '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 type-small text-ink-muted', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
