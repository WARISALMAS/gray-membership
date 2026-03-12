import type { Metadata, Viewport } from 'next'
import { Raleway, Cinzel } from 'next/font/google' // Import both fonts
import { QueryProvider } from '@/components/providers/QueryProvider'
import './globals.css'

// Configure Raleway Medium
const raleway = Raleway({
  subsets: ['latin'],
  weight: '500', // Medium
  variable: '--font-raleway',
})

// Configure Cinzel Regular/700
const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-cinzel',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Gray Wellness',
  description:
    'Movement, recovery and nourishment in a calm, considered space. Premium wellness and fitness in Dubai and Ibiza.',
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
    // Add both font variables here
    <html lang="en" className={`${raleway.variable} ${cinzel.variable}`}>
      <body className="font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}