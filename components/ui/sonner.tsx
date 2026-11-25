'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'

/**
 * Toast (sonner, restyled).
 *
 * A white card at the card radius with the one raised shadow, ink text and a
 * left rule that carries the tone. Sonner's own classes are replaced rather
 * than themed through `richColors`, so a success toast is a calm green rule on
 * a white card instead of a green slab.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            'group toast',
            'rounded-[var(--radius-card)] border border-line bg-card text-ink raised',
            'p-3 pl-4 type-small',
            'border-l-2 border-l-line-strong',
            'gap-3',
          ].join(' '),
          title: 'type-small font-medium text-ink',
          description: 'type-caption text-ink-muted',
          actionButton:
            'rounded-[var(--radius-control)] bg-primary px-2.5 py-1 type-caption font-medium text-primary-foreground',
          cancelButton:
            'rounded-[var(--radius-control)] bg-muted px-2.5 py-1 type-caption font-medium text-ink',
          closeButton: 'rounded-[var(--radius-control)] bg-card text-ink-muted',
          success: '[&]:border-l-success',
          error: '[&]:border-l-danger',
          warning: '[&]:border-l-warning',
          info: '[&]:border-l-info',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--card)',
          '--normal-text': 'var(--ink)',
          '--normal-border': 'var(--line)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
