'use client'

import * as React from 'react'
import { Instrument_Sans, Instrument_Serif } from 'next/font/google'

/**
 * The Batch 3A editorial type pairing.
 *
 * These two families are only used by the screens that opt into the dashboard
 * design system (`.dash-surface` / `.dash-display`): the dashboard, the admin
 * console and the restaurant registration page. They used to be loaded in
 * `app/layout.tsx`, which meant every visitor - including every storefront
 * customer - downloaded two font families they never saw.
 *
 * They now live here and are pulled in by the three layouts that need them.
 * The CSS variable names are unchanged (`--font-editorial`,
 * `--font-dashboard-ui`), so every token in `app/globals.css` and every
 * component that reads them keeps working untouched.
 */
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-editorial',
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dashboard-ui',
})

/** The two `__variable` classes injected by next/font. */
export const editorialFontClassName = `${instrumentSerif.variable} ${instrumentSans.variable}`

/**
 * Puts the pairing on the screen, and nowhere else.
 *
 * Two layers, because the design system is used in two places:
 *  - the class on the wrapper covers everything inside this subtree, including
 *    the first paint (no flash of a fallback face);
 *  - the root variables cover dialogs, dropdowns and toasts, which Radix and
 *    sonner render into `document.body`, outside the wrapper. Those only ever
 *    appear after a click, so doing it on mount is enough - and they are removed
 *    again on the way out so a following storefront page never carries them.
 */
export function useEditorialFontRoot() {
  React.useEffect(() => {
    const root = document.documentElement
    const serif = instrumentSerif.style.fontFamily
    const sans = instrumentSans.style.fontFamily
    root.style.setProperty('--font-editorial', serif)
    root.style.setProperty('--font-dashboard-ui', sans)
    return () => {
      root.style.removeProperty('--font-editorial')
      root.style.removeProperty('--font-dashboard-ui')
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
