'use client'

import * as React from 'react'
import { MailCheck, X } from 'lucide-react'

/**
 * Non-blocking email verification banner.
 *
 * Access is never gated on verification, so this is a quiet notice above the
 * page content with one action (resend) and one dismissal. It removes itself the
 * moment the address is confirmed, and it renders nothing at all if the account
 * is already verified or the column has not been migrated yet.
 */
export function VerifyEmailBanner() {
  const [state, setState] = React.useState<'loading' | 'hidden' | 'unverified' | 'verified'>('loading')
  const [email, setEmail] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const dismissed = typeof window !== 'undefined' && window.sessionStorage.getItem('fb_verify_dismissed') === '1'
    if (dismissed) {
      setState('hidden')
      return
    }
    fetch('/api/user/profile', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return setState('hidden')
        setEmail(typeof data.user.email === 'string' ? data.user.email : null)
        if (data.user.email_verified === false) setState('unverified')
        else setState('verified')
      })
      .catch(() => {
        if (!cancelled) setState('hidden')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    try {
      window.sessionStorage.setItem('fb_verify_dismissed', '1')
    } catch {
      // private mode: dismissal just does not persist
    }
    setState('hidden')
  }

  const resend = async () => {
    if (sending) return
    setSending(true)
    setMessage('')
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setSent(true)
        setMessage('Sent. The link expires in 72 hours.')
      } else {
        setMessage(typeof data?.error === 'string' ? data.error : 'Could not send the link right now.')
      }
    } catch {
      setMessage('Could not send the link right now.')
    } finally {
      setSending(false)
    }
  }

  if (state !== 'unverified') return null

  return (
    <div className="dash-surface mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-3.5 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-[var(--dash-brown)]" aria-hidden="true" />
          <p className="text-[12.5px] leading-[1.5] text-[var(--dash-ink-2)]">
            <span className="font-semibold text-[var(--dash-ink-1)]">Confirm your email.</span>{' '}
            {sent
              ? message
              : `We sent a link to ${email ?? 'your inbox'}. Everything works without it, but order alerts and payout notices are more reliable once confirmed.`}
            {!sent && message ? (
              <span className="ml-1 text-[var(--dash-danger)]">{message}</span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!sent ? (
            <button
              type="button"
              onClick={() => void resend()}
              disabled={sending}
              className="dash-tap inline-flex h-9 items-center rounded-[6px] border border-[var(--dash-line-strong)] px-2.5 text-[12px] font-medium text-[var(--dash-ink-1)] hover:bg-[var(--dash-sand)] disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Resend link'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="dash-tap flex size-9 items-center justify-center rounded-[6px] text-[var(--dash-ink-4)] hover:bg-[var(--dash-surface-inset)] hover:text-[var(--dash-ink-1)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
