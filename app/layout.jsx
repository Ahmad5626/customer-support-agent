import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata = {
  title: 'Resolve — AI Refund Support',
  description: 'An AI customer support agent that makes fast, policy-aware refund decisions.',
  generator: 'Next.js',
  
}

export const viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
