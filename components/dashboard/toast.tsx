'use client'

import { toast as sonnerToast } from 'sonner'

/**
 * Toast
 *
 * The app already mounts Sonner's <Toaster position="top-center" richColors /> in
 * app/layout.tsx, so this module is a thin, opinionated wrapper rather than a
 * second toast system. House rules:
 *  - 1 line title, optional 1 line description. No exclamation marks.
 *  - 4s for confirmations, 7s for failures the reader may need to act on.
 *  - Never used for inline field validation; fields own their own errors.
 */

type Options = {
  description?: string
  /** Milliseconds. Defaults to 4000 for success/info, 7000 for errors. */
  duration?: number
  id?: string
  action?: { label: string; onClick: () => void }
}

function emit(kind: 'success' | 'error' | 'info' | 'warning', message: string, options?: Options) {
  const duration = options?.duration ?? (kind === 'error' ? 7000 : 4000)
  const payload = {
    duration,
    id: options?.id,
    description: options?.description,
    action: options?.action,
    className: 'dash-surface',
    style: {
      borderRadius: '10px',
      border: '1px solid var(--dash-line)',
      background: 'var(--dash-surface)',
      color: 'var(--dash-ink-1)',
      fontSize: '13px',
      boxShadow: 'var(--dash-shadow-2)',
    },
  }
  if (kind === 'success') return sonnerToast.success(message, payload)
  if (kind === 'error') return sonnerToast.error(message, payload)
  if (kind === 'warning') return sonnerToast.warning(message, payload)
  return sonnerToast(message, payload)
}

export const toast = {
  success: (message: string, options?: Options) => emit('success', message, options),
  error: (message: string, options?: Options) => emit('error', message, options),
  warning: (message: string, options?: Options) => emit('warning', message, options),
  info: (message: string, options?: Options) => emit('info', message, options),
  dismiss: (id?: string) => sonnerToast.dismiss(id),
  /** Wraps a promise and reports the three possible outcomes with one call. */
  async task<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((value: T) => string); error: string },
  ) {
    return sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      className: 'dash-surface',
    })
  },
}

/**
 * ToastRegion: renders nothing. It exists so a screen can declare its intent to
 * use toasts in one place and so the design system documents the single global
 * toaster. Mount <Toaster /> once at the root (already done in app/layout.tsx).
 */
export function ToastRegion() {
  return null
}
