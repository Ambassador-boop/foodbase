'use client'

import * as React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

/**
 * ConfirmDialog
 *
 * For actions that remove access or move money-adjacent state. Copy rule:
 * the title names the action, the description states the consequence, and the
 * confirm button repeats the verb. Never "Are you sure?".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'brand'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <AlertDialogContent className="dash-surface w-[calc(100vw-32px)] max-w-[440px] gap-0 rounded-[12px] border border-[var(--dash-line)] bg-[var(--dash-surface)] p-0">
        <AlertDialogHeader className="gap-0 px-5 pb-4 pt-5 text-left">
          <div className="mb-3 flex items-start gap-2.5">
            <span
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                tone === 'danger'
                  ? 'bg-[var(--dash-danger-bg)] text-[var(--dash-danger)]'
                  : 'bg-[var(--dash-sand)] text-[var(--dash-brown)]',
              )}
              aria-hidden="true"
            >
              <AlertTriangle className="size-3.5" />
            </span>
            <AlertDialogTitle className="text-[15px] font-semibold leading-6 text-[var(--dash-ink-1)]">
              {title}
            </AlertDialogTitle>
          </div>
          {description ? (
            <AlertDialogDescription asChild>
              <div className="pl-[38px] text-[12.5px] leading-[1.55] text-[var(--dash-ink-3)]">{description}</div>
            </AlertDialogDescription>
          ) : null}
          {children ? <div className="mt-3 pl-[38px]">{children}</div> : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 border-t border-[var(--dash-line)] bg-[var(--dash-surface-sunken)] px-5 py-3 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            disabled={loading}
            className="mt-0 inline-flex h-11 w-full items-center justify-center rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-3 text-[12.5px] font-medium text-[var(--dash-ink-1)] hover:bg-white sm:h-9 sm:w-auto"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
            className={cn(
              'inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[12.5px] font-semibold text-white sm:h-9 sm:w-auto',
              tone === 'danger'
                ? 'bg-[var(--dash-danger)] hover:bg-[var(--dash-danger)]/90'
                : 'bg-[var(--dash-brown)] hover:bg-[var(--dash-brown-deep)]',
            )}
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
