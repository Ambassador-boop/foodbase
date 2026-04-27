import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'FoodBase',
  description: 'Seamless restaurant ordering and payment platform for modern food businesses',
  generator: 'v0.app',
  applicationName: 'FoodBase',
  authors: [{ name: 'Wisdom Technologies' }],
  keywords: ['restaurant', 'ordering', 'food', 'saas', 'payments'],
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
    description: 'Seamless restaurant ordering and payment platform',
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
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <Analytics />
      </body>
    </html>
  )
}
