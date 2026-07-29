import type { Metadata } from 'next'
import './globals.css'
import { PageTransition } from '@/components/PageTransition'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Veritas — The Truth Machine',
  description:
    'End-to-end AI fact-checker. Transcribe conversations, extract claims, verify against live web sources, and issue per-speaker verdicts.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </body>
    </html>
  )
}
