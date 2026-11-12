'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FormField,
  TextField,
  PasswordField,
  CheckboxField,
  SelectField,
  CheckmarkList,
} from '@/components/dashboard/form-field'
import { RegistrationPanel } from '@/components/registration/registration-panel'
import {
  registrationSchema,
  fieldErrors,
  suggestSlug,
  checkSlugShape,
  normaliseNigerianPhone,
  formatPhoneForDisplay,
  scorePassword,
  NIGERIAN_STATES,
  SLUG_MAX,
} from '@/lib/registration/validation'

/**
 * Public restaurant registration form.
 *
 * One page, three labelled sections, no wizard: the fields are short enough that
 * hiding half of them costs more than it saves. Validation mirrors the server
 * schema exactly, so a field that passes here passes there.
 */

type Values = {
  first_name: string
  last_name: string
  email: string
  phone: string
  password: string
  restaurant_name: string
  slug: string
  city: string
  state: string
}

const EMPTY: Values = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  restaurant_name: '',
  slug: '',
  city: '',
  state: '',
}

type SlugState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; message: string }
  | { status: 'unavailable'; message: string; suggestion?: string }
  | { status: 'error'; message: string }

export function RegistrationForm() {
  const router = useRouter()
  const [values, setValues] = React.useState<Values>(EMPTY)
  const [accept, setAccept] = React.useState(false)
  const [slugEdited, setSlugEdited] = React.useState(false)
  const [slugState, setSlugState] = React.useState<SlugState>({ status: 'idle' })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [honeypot, setHoneypot] = React.useState('')
  const errorSummaryRef = React.useRef<HTMLDivElement | null>(null)

  const strength = React.useMemo(() => scorePassword(values.password), [values.password])

  const set = (key: keyof Values) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.value
    setValues((current) => {
      const next = { ...current, [key]: value }
      // Slug follows the restaurant name until the owner edits it themselves.
      if (key === 'restaurant_name' && !slugEdited) next.slug = suggestSlug(value)
      return next
    })
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  /* ------------------------- live slug availability ------------------------ */

  React.useEffect(() => {
    const slug = values.slug.trim().toLowerCase()
    if (!slug) {
      setSlugState({ status: 'idle' })
      return
    }
    const shape = checkSlugShape(slug)
    if (!shape.ok) {
      setSlugState({ status: 'unavailable', message: shape.reason })
      return
    }

    const controller = new AbortController()
    setSlugState({ status: 'checking' })
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/auth/register-restaurant/slug?slug=${encodeURIComponent(slug)}`, {
          signal: controller.signal,
          headers: { accept: 'application/json' },
        })
        const data = await response.json()
        if (data.available) {
          setSlugState({ status: 'available', message: 'Available' })
        } else {
          setSlugState({
            status: 'unavailable',
            message: typeof data.message === 'string' ? data.message : 'That address is not available.',
            suggestion: typeof data.suggestion === 'string' ? data.suggestion : undefined,
          })
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
        setSlugState({ status: 'error', message: 'Could not check availability. You can still continue.' })
      }
    }, 450)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [values.slug])

  const applySuggestion = (slug: string) => {
    setValues((current) => ({ ...current, slug }))
    setSlugEdited(true)
  }

  /* -------------------------------- submit -------------------------------- */

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    if (submitting) return

    // Honeypot: a human never fills this. Fail quietly with the same message a
    // validation error would produce, so bots learn nothing.
    if (honeypot.trim().length > 0) {
      setFormError('We could not create this account. Check your details and try again.')
      return
    }

    const payload = {
      ...values,
      phone: values.phone.trim(),
      accept_terms: accept,
      company_website: honeypot,
    }

    const parsed = registrationSchema.safeParse(payload)
    const nextErrors: Record<string, string> = parsed.success ? {} : fieldErrors(parsed.error)

    const shape = checkSlugShape(values.slug)
    if (!shape.ok) nextErrors.slug = shape.reason
    else if (slugState.status === 'unavailable') nextErrors.slug = 'Choose an available address.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setFormError('Check the highlighted fields before continuing.')
      requestAnimationFrame(() => errorSummaryRef.current?.focus())
      return
    }

    setSubmitting(true)
    setErrors({})

    try {
      const response = await fetch('/api/auth/register-restaurant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data?.fields && typeof data.fields === 'object') {
          setErrors(data.fields as Record<string, string>)
        }
        setFormError(
          typeof data?.error === 'string'
            ? data.error
            : 'We could not create the account right now. Try again in a moment.',
        )
        requestAnimationFrame(() => errorSummaryRef.current?.focus())
        setSubmitting(false)
        return
      }

      router.push(typeof data?.redirectUrl === 'string' ? data.redirectUrl : '/dashboard/onboarding')
      router.refresh()
    } catch {
      setFormError('Your connection dropped before we finished. Try again.')
      setSubmitting(false)
    }
  }

  /* -------------------------------- render -------------------------------- */

  const slugHint = (() => {
    if (slugState.status === 'checking') return 'Checking availability…'
    if (slugState.status === 'available') return 'This address is free.'
    if (slugState.status === 'unavailable' || slugState.status === 'error') return slugState.message
    return 'Lowercase letters, numbers and single hyphens. 3 to 40 characters.'
  })()

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)] lg:gap-12 xl:gap-16">
      {/* -------------------------------- form -------------------------------- */}
      <div className="min-w-0 lg:max-w-[620px]">
        <form onSubmit={handleSubmit} noValidate className="min-w-0">
          {formError ? (
            <div
              ref={errorSummaryRef}
              tabIndex={-1}
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-[8px] border border-[var(--dash-danger)]/30 bg-[var(--dash-danger-bg)] px-4 py-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--dash-danger)]" aria-hidden="true" />
              <p className="text-[12.5px] leading-[1.5] text-[var(--dash-ink-1)]">{formError}</p>
            </div>
          ) : null}

          {/* Honeypot: hidden from sight and from assistive tech. */}
          <div aria-hidden="true" className="pointer-events-none absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
            <label htmlFor="company_website">Company website</label>
            <input
              id="company_website"
              name="company_website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <SectionHeading index="01" title="Your account" note="How you sign in and where we reach you." />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="First name"
              required
              autoComplete="given-name"
              value={values.first_name}
              onChange={set('first_name')}
              error={errors.first_name}
              placeholder="Adaeze"
            />
            <TextField
              label="Last name"
              required
              autoComplete="family-name"
              value={values.last_name}
              onChange={set('last_name')}
              error={errors.last_name}
              placeholder="Okafor"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <TextField
              label="Work email"
              type="email"
              required
              inputMode="email"
              autoComplete="email"
              value={values.email}
              onChange={set('email')}
              error={errors.email}
              hint="Order alerts and payout notices go here."
              placeholder="you@restaurant.com"
            />
            <TextField
              label="Mobile number"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              onBlur={() => {
                const normalised = normaliseNigerianPhone(values.phone)
                if (normalised) setValues((current) => ({ ...current, phone: formatPhoneForDisplay(normalised) }))
              }}
              error={errors.phone}
              hint="A Nigerian number, for example 0803 123 4567."
              placeholder="0803 123 4567"
            />
            <div>
              <PasswordField
                label="Password"
                required
                autoComplete="new-password"
                value={values.password}
                onChange={set('password')}
                error={errors.password}
                hint="At least 8 characters. A phrase you will remember beats a symbol soup."
                placeholder="Enter a password"
              />
              {values.password ? (
                <div className="mt-2" aria-live="polite">
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors duration-150',
                          step <= strength.score
                            ? strength.score >= 3
                              ? 'bg-[var(--dash-success)]'
                              : 'bg-[var(--dash-warning)]'
                            : 'bg-[var(--dash-line)]',
                        )}
                      />
                    ))}
                    <span className="ml-1 w-11 text-right text-[11px] font-semibold text-[var(--dash-ink-2)]">
                      {strength.label}
                    </span>
                  </div>
                  {strength.problems.length > 0 ? (
                    <p className="mt-1 text-[11.5px] text-[var(--dash-ink-3)]">{strength.problems[0]}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <SectionHeading
            index="02"
            title="Your restaurant"
            note="This is what customers see, and the address they type."
            className="mt-8"
          />

          <div className="grid grid-cols-1 gap-4">
            <TextField
              label="Restaurant name"
              required
              value={values.restaurant_name}
              onChange={set('restaurant_name')}
              error={errors.restaurant_name}
              placeholder="Mama Nkechi's Kitchen"
            />

            <FormField
              label="Storefront address"
              htmlFor="slug"
              required
              error={errors.slug}
              hint={slugHint}
            >
              {(meta) => (
                <div
                  className={cn(
                    'flex h-11 min-w-0 items-stretch overflow-hidden rounded-[8px] border bg-[var(--dash-surface)] transition-colors duration-150',
                    errors.slug
                      ? 'border-[var(--dash-danger)]'
                      : 'border-[var(--dash-line-strong)] focus-within:border-[var(--dash-brown)]',
                  )}
                >
                  <span className="flex shrink-0 items-center border-r border-[var(--dash-line)] bg-[var(--dash-surface-inset)] px-2.5 text-[12px] font-medium text-[var(--dash-ink-3)]">
                    foodbase.ng/
                  </span>
                  <input
                    id={meta.id}
                    name="slug"
                    value={values.slug}
                    onChange={(event) => {
                      setSlugEdited(true)
                      const next = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, SLUG_MAX)
                      setValues((current) => ({ ...current, slug: next }))
                      setErrors((current) => {
                        if (!current.slug) return current
                        const copy = { ...current }
                        delete copy.slug
                        return copy
                      })
                    }}
                    onFocus={() => setSlugEdited(true)}
                    aria-describedby={meta['aria-describedby']}
                    aria-invalid={errors.slug ? true : undefined}
                    aria-required
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="url"
                    placeholder="mama-nkechis-kitchen"
                    className="min-w-0 flex-1 bg-transparent px-2.5 text-[13.5px] text-[var(--dash-ink-1)] outline-none placeholder:text-[var(--dash-ink-4)]"
                  />
                  <span className="flex shrink-0 items-center pr-2.5" aria-hidden="true">
                    {slugState.status === 'checking' ? (
                      <Loader2 className="size-4 animate-spin text-[var(--dash-ink-4)]" />
                    ) : slugState.status === 'available' ? (
                      <Check className="size-4 text-[var(--dash-success)]" />
                    ) : slugState.status === 'unavailable' ? (
                      <X className="size-4 text-[var(--dash-danger)]" />
                    ) : null}
                  </span>
                </div>
              )}
            </FormField>

            {slugState.status === 'unavailable' && slugState.suggestion ? (
              <div className="-mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--dash-ink-3)]">
                <span>Try</span>
                <button
                  type="button"
                  onClick={() => applySuggestion(slugState.suggestion as string)}
                  className="dash-tap rounded-full border border-[var(--dash-line-strong)] bg-[var(--dash-surface)] px-2.5 py-1 font-medium text-[var(--dash-ink-1)] hover:border-[var(--dash-brown)] hover:text-[var(--dash-brown)]"
                >
                  {slugState.suggestion}
                </button>
                <span>instead.</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label="City"
                required
                autoComplete="address-level2"
                value={values.city}
                onChange={set('city')}
                error={errors.city}
                placeholder="Enugu"
              />
              <SelectField
                label="State"
                required
                value={values.state}
                onChange={set('state')}
                error={errors.state}
              >
                <option value="">Choose a state</option>
                {NIGERIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <SectionHeading index="03" title="Before you start" note="Two documents, one checkbox." className="mt-8" />

          <div className="rounded-[8px] border border-[var(--dash-line)] bg-[var(--dash-surface-sunken)] px-4 py-1">
            <CheckboxField
              id="accept_terms"
              checked={accept}
              onChange={(event) => {
                setAccept(event.target.checked)
                setErrors((current) => {
                  if (!current.accept_terms) return current
                  const copy = { ...current }
                  delete copy.accept_terms
                  return copy
                })
              }}
              error={errors.accept_terms}
              label={
                <>
                  I accept the{' '}
                  <Link href="/terms" className="font-medium text-[var(--dash-brown)] underline-offset-4 hover:underline">
                    Terms of Service
                  </Link>{' '}
                  and the{' '}
                  <Link href="/privacy" className="font-medium text-[var(--dash-brown)] underline-offset-4 hover:underline">
                    Privacy Notice
                  </Link>
                  .
                </>
              }
              description="We record the date and the document version you accepted. You can close your account at any time."
            />
          </div>

          <CheckmarkList
            items={[
              'The account is active straight away. No approval queue.',
              'You can add your bank account and PIN later, from Finance and Security.',
              'Nothing is visible to customers until you publish a menu.',
            ]}
            className="mt-5"
          />

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className="dash-tap inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[var(--dash-brown)] px-5 text-[13.5px] font-semibold text-white hover:bg-[var(--dash-brown-deep)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {submitting ? 'Creating your restaurant…' : 'Create restaurant account'}
            </button>
            <p className="text-[12px] text-[var(--dash-ink-3)]">
              Already registered?{' '}
              <Link href="/login" className="font-medium text-[var(--dash-brown)] underline-offset-4 hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>

      {/* ------------------------------- panel ------------------------------- */}
      <div className="order-first min-w-0 lg:order-none">
        <RegistrationPanel />
      </div>
    </div>
  )
}

function SectionHeading({
  index,
  title,
  note,
  className,
}: {
  index: string
  title: string
  note?: string
  className?: string
}) {
  return (
    <div className={cn('mb-4 mt-2 flex items-baseline gap-3 border-b border-[var(--dash-line)] pb-2', className)}>
      <span className="dash-num text-[11px] font-semibold text-[var(--dash-brown)]">{index}</span>
      <h2 className="text-[14px] font-semibold text-[var(--dash-ink-1)]">{title}</h2>
      {note ? <span className="ml-auto hidden text-[11.5px] text-[var(--dash-ink-4)] sm:block">{note}</span> : null}
    </div>
  )
}
