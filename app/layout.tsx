import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
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
    url: 'https://myfoodbase.vercel.app',
    siteName: 'FoodBase',
    description: 'Seamless restaurant ordering and payment platform',
  },
}

export const viewport: Viewport = {
  themeColor: '#8B7500',
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
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
