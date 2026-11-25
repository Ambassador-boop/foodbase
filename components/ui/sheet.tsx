'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { X } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { useIsMobile } from '@/components/ui/use-mobile'

/**
 * Sheet.
 *
 * On a phone a side sheet is the wrong shape: it covers half the screen and
 * leaves a strip of dead page beside it. Below 768 px every side sheet becomes
 * a bottom sheet, full width, top corners at the card radius, with a grab
 * handle. On a tablet and up the requested side is honoured. Pass
 * `mobileSide="side"` to opt out for the few cases where a drawer must stay a
 * drawer (a nav panel, for example).
 */

type SheetSide = 'top' | 'right' | 'bottom' | 'left'

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-[rgba(31,22,17,0.45)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'duration-[200ms]',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = 'right',
  mobileSide = 'bottom',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: SheetSide
  /** What a side sheet does under 768 px. Default: become a bottom sheet. */
  mobileSide?: 'bottom' | 'side'
}) {
  const isMobile = useIsMobile()
  const resolved: SheetSide =
    isMobile && mobileSide === 'bottom' && (side === 'right' || side === 'left')
      ? 'bottom'
      : side

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={resolved}
        className={cn(
          'fixed z-50 flex flex-col gap-4 bg-card raised',
          'transition ease-brand duration-[300ms]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          resolved === 'right' &&
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-full border-l border-line sm:max-w-sm',
          resolved === 'left' &&
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-full border-r border-line sm:max-w-sm',
          resolved === 'top' &&
            'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b border-line rounded-b-[var(--radius-card)]',
          resolved === 'bottom' &&
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 max-h-[90svh] overflow-y-auto border-t border-line rounded-t-[var(--radius-card)] pb-[max(16px,env(safe-area-inset-bottom))]',
          className,
        )}
        {...props}
      >
        {resolved === 'bottom' ? (
          <div
            aria-hidden
            className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line-strong"
          />
        ) : null}
        {children}
        <SheetPrimitive.Close
          className={cn(
            'absolute top-3 right-3 inline-flex size-9 items-center justify-center',
            'rounded-[var(--radius-control)] text-ink-muted',
            'transition-colors duration-[120ms] ease-brand',
            'hover:bg-brand-50 hover:text-ink',
            'disabled:pointer-events-none',
          )}
        >
          <X className="size-5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 px-5 pt-2 pr-14', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 px-5 pb-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('type-h3 text-ink', className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('type-small text-ink-muted', className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
