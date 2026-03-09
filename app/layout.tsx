import type { Metadata, Viewport } from 'next'

import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Seven Club - A wellness club for real life',
  description: 'Movement, recovery and nourishment in a calm, considered space. Premium wellness and fitness in Dubai and Ibiza.',
  generator: 'v0.app',
    icons: {
    icon: '/images/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
