'use client'

import * as React from 'react'
import { Check, Copy } from '@phosphor-icons/react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * CopyButton. Copies a reference, an account number or a link, then says so in
 * words for two seconds. The confirmation is a live region, not just an icon
 * change, and it reverts on its own so the button is usable again.
 */
export type CopyButtonProps = {
  value: string
  /** Visible label. Omit for an icon-only button, which then needs `label`. */
  children?: React.ReactNode
  /** Accessible name, required when there is no visible label. */
  label?: string
  size?: 'sm' | 'default' | 'icon' | 'icon-sm'
  variant?: 'ghost' | 'outline' | 'secondary' | 'default'
  className?: string
}

export function CopyButton({
  value,
  children,
  label = 'Copy',
  size = 'icon-sm',
  variant = 'ghost',
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false)
  const timeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current)
    }
  }, [])

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        // Older Safari and any context without the async clipboard API.
        const area = document.createElement('textarea')
        area.value = value
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        document.execCommand('copy')
        document.body.removeChild(area)
      }
      setCopied(true)
      if (timeout.current) clearTimeout(timeout.current)
      timeout.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Copying is a convenience; a refusal is not an error worth shouting about.
      setCopied(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={copy}
        aria-label={children ? undefined : copied ? 'Copied' : label}
        className={className}
      >
        {copied ? <Check weight="bold" aria-hidden /> : <Copy aria-hidden />}
        {children ? (copied ? 'Copied' : children) : null}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  )
}
