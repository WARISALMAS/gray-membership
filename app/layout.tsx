import type { Metadata, Viewport } from 'next'
import { Raleway } from 'next/font/google' // 1. Import the font

import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

// 2. Configure Raleway Medium
const raleway = Raleway({
  subsets: ['latin'],
  weight: '500', // Medium
  variable: '--font-raleway',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Gray Wellness',
  description: 'Movement, recovery and nourishment in a calm, considered space. Premium wellness and fitness in Dubai and Ibiza.',
  generator: 'v0.app',
  icons: {
    icon: '/images/icon.webp',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // 3. Add the font variable here
    <html lang="en" className={`${raleway.variable}`}>
      <body className="font-sans antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  )
}
