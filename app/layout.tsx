import { TooltipProvider } from '@/components/ui/tooltip'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: 'branderize',
  title: 'branderize | Your AI marketing team',
  description: 'Branderize learns your business and directs six marketing specialists from one shared source of truth.',
  openGraph: {
    title: 'branderize | Your AI marketing team',
    description: 'One shared brand context. Six coordinated marketing specialists.',
    locale: 'en_US',
    siteName: 'branderize',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'branderize | Your AI marketing team',
    description: 'One shared brand context. Six coordinated marketing specialists.',
  },
}

export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f2f1ee' }, { media: '(prefers-color-scheme: dark)', color: '#151515' }], userScalable: true }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable} bg-background`}><body className="font-sans antialiased"><TooltipProvider>{children}</TooltipProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
