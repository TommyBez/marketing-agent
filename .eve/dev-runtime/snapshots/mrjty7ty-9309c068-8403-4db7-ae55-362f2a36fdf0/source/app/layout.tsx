import { TooltipProvider } from '@/components/ui/tooltip'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Newsreader } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const newsreader = Newsreader({ subsets: ['latin'], variable: '--font-newsreader' })

export const metadata: Metadata = {
  title: 'Relay — One marketing mind. A whole team behind it.',
  description: 'Relay learns your business and coordinates six marketing specialists to turn strategy into ready-to-review marketing work.',
}

export const viewport: Viewport = { colorScheme: 'light dark', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f2f0ea' }, { media: '(prefers-color-scheme: dark)', color: '#10110f' }], userScalable: true }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} font-sans antialiased`}><TooltipProvider>{children}</TooltipProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
