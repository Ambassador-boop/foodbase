'use client'

import * as React from 'react'
import { Instrument_Serif } from 'next/font/google'

/**
 * The Batch 3A editorial serif.
 *
 * Only the screens that opt into the dashboard design system (`.dash-surface` /
 * `.dash-display`) use it: the dashboard, the admin console and the restaurant
 * registration page. It used to be loaded in `app/layout.tsx`, which meant every
 * visitor, including every storefront customer, downloaded a font they never saw.
 *
 * The interface face is no longer loaded here. Instrument Sans is now the
 * product's one interface face and is loaded once in `app/layout.tsx` as
 * `--font-sans`, so `--font-dashboard-ui` resolves to it through CSS
 * (`var(--font-dashboard-ui), var(--font-sans)`) instead of being downloaded a
 * second time for three screens.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-editorial',
})

/** The `__variable` class injected by next/font. */
export const editorialFontClassName = instrumentSerif.variable

/**
 * Puts the serif on the screen, and nowhere else.
 *
 * Two layers, because the design system is used in two places:
 *  - the class on the wrapper covers everything inside this subtree, including
 *    the first paint (no flash of a fallback face);
 *  - the root variable covers dialogs, dropdowns and toasts, which Radix and
 *    sonner render into `document.body`, outside the wrapper. Those only ever
 *    appear after a click, so doing it on mount is enough - and it is removed
 *    again on the way out so a following storefront page never carries it.
 */
export function useEditorialFontRoot() {
  React.useEffect(() => {
    const root = document.documentElement
    const serif = instrumentSerif.style.fontFamily
    root.style.setProperty('--font-editorial', serif)
    return () => {
      root.style.removeProperty('--font-editorial')
    }
  }, [])
}

/**
 * For screens whose layout is already a client component: call the hook and put
 * `editorialFontClassName` on the element that wraps the screen.
 */
export function EditorialFontScope({ children }: { children: React.ReactNode }) {
  useEditorialFontRoot()
  return <div className={editorialFontClassName}>{children}</div>
}
