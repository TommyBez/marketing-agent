import { AppAnalytics } from '@/components/app-analytics'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'branderize',
  title: 'branderize | Brief once. Move as one.',
  description: 'Add your website once. Branderize turns it into a shared company brief, assigns the right specialists, and returns one coordinated answer.',
  openGraph: {
    title: 'branderize | Brief once. Move as one.',
    description: 'One company brief. The right marketing specialists. One coordinated answer.',
    locale: 'en_US',
    siteName: 'branderize',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'branderize | Brief once. Move as one.',
    description: 'One company brief. The right marketing specialists. One coordinated answer.',
  },
}

export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f2f1ee' }, { media: '(prefers-color-scheme: dark)', color: '#151515' }], userScalable: true }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        {process.env.NODE_ENV === 'production' && (
          <Suspense fallback={null}>
            <AppAnalytics />
          </Suspense>
        )}
      </body>
    </html>
  )
}
