import type { Metadata, Viewport } from 'next'
import { Fraunces, Geist_Mono, Instrument_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { HideV0Badge } from '@/components/HideV0Badge'
import './globals.css'

/**
 * Two faces, one monospace.
 *
 * Fraunces (display) and Instrument Sans (interface) are loaded for the whole
 * product. Both ask for latin AND latin-ext on purpose: the Naira sign U+20A6
 * lives in latin-ext, and a price that renders a missing-glyph box is a bug
 * customers see on every screen. `display: 'swap'` keeps text visible while
 * the faces load.
 *
 * Geist Mono is kept because references, order IDs and bank account numbers are
 * set in a monospace across the admin and finance screens. It is the one
 * monospace the product uses; it also needs latin-ext for the Naira sign.
 *
 * The Batch 3A editorial serif (Instrument Serif) is still NOT loaded here: it
 * is only used by the dashboard, the admin console and the registration page,
 * each of which pulls it in through lib/editorial-fonts.tsx.
 */
const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-instrument-sans',
})

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-fraunces',
})

const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://foodbase.ng'),
  title: {
    default: 'FoodBase',
    template: '%s | FoodBase',
  },
  description:
    'FoodBase helps restaurants and food lovers connect — order food, manage menus, track orders, and process payments all in one place.',
  applicationName: 'FoodBase',
  authors: [{ name: 'Wisdom Technologies' }],
  keywords: [
    'restaurant',
    'food ordering',
    'order food online',
    'food delivery Nigeria',
    'restaurant management',
    'menu management',
    'payments',
    'Abuja food',
    'Lagos food',
    'Nigeria food',
  ],
  alternates: {
    canonical: 'https://foodbase.ng',
  },
  // The icon files below are Next.js file conventions (app/icon.svg,
  // app/apple-icon.png, app/favicon.ico) from the logo kit, so they are
  // resolved automatically and are deliberately not listed here.
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://foodbase.ng',
    siteName: 'FoodBase',
    title: 'FoodBase',
    description:
      'FoodBase connects restaurants and food lovers — order food, manage menus, and process payments seamlessly.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FoodBase',
    description:
      'FoodBase connects restaurants and food lovers — order food, manage menus, and process payments seamlessly.',
  },
}

export const viewport: Viewport = {
  themeColor: '#8C3800',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'light',
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${fraunces.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
            if (!navigator.userAgent.includes('median')) {
              var script = document.createElement('script');
              script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
              script.defer = true;
              document.head.appendChild(script);
              
              window.OneSignalDeferred = window.OneSignalDeferred || [];
              OneSignalDeferred.push(async function(OneSignal) {
                await OneSignal.init({
                  appId: "0977c693-6f5a-454d-b8e1-d44c7e6c0ed7",
                });
              });
            }
          `
        }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "FoodBase",
              "url": "https://foodbase.ng"
            })
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <HideV0Badge />
        {children}
        <Toaster position="top-center" closeButton />
        <Analytics />
      </body>
    </html>
  )
}
