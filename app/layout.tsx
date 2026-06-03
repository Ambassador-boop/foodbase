import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import { HideV0Badge } from '@/components/HideV0Badge'
import './globals.css'

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'FoodBase',
  description: 'FoodBase helps restaurants and food lovers connect — order food, manage menus, track orders, and process payments all in one place.',
  generator: 'v0.app',
  applicationName: 'FoodBase',
  authors: [{ name: 'Wisdom Technologies' }],
  keywords: ['restaurant', 'food ordering', 'order food online', 'food delivery Nigeria', 'restaurant management', 'menu management', 'payments', 'Abuja food', 'Lagos food', 'Nigeria food'],
  alternates: {
    canonical: 'https://foodbase.ng',
  },
  icons: {
    icon: [
      {
        url: '/foodbase-logo.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/foodbase-logo.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/foodbase-logo.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://foodbase.ng',
    siteName: 'FoodBase',
    description: 'FoodBase connects restaurants and food lovers — order food, manage menus, and process payments seamlessly.',
  },
}

export const viewport: Viewport = {
  themeColor: '#8E3800',
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
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            window.OneSignalDeferred = window.OneSignalDeferred || [];
            OneSignalDeferred.push(async function(OneSignal) {
              await OneSignal.init({
                appId: "0977c693-6f5a-454d-b8e1-d44c7e6c0ed7",
              });
            });
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
        <Toaster position="top-center" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
