'use client'

import Link from 'next/link'
import { useReveal } from './useReveal'

export function ProductCTA() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="product"
      style={{ padding: '140px 48px' }}
    >
      <div className="section-label reveal">
        <span className="num">(04)</span>
        <span>THE PRODUCT</span>
      </div>
      <h2
        className="reveal delay-1"
        style={{
          fontSize: 48,
          letterSpacing: '-1.2px',
          fontWeight: 500,
          margin: '0 0 14px',
          color: 'var(--text)',
        }}
      >
        Try it now.
      </h2>
      <p
        className="reveal delay-2"
        style={{ fontSize: 18, color: 'var(--text-muted)', marginBottom: 40, maxWidth: 540 }}
      >
        Run the demo to see the full pipeline in action — mic in, verdicts out, per-speaker
        accuracy at the bottom.
      </p>
      <Link
        href="/app"
        className="reveal delay-3"
        style={{
          display: 'inline-block',
          padding: '16px 28px',
          background: 'var(--coral)',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          letterSpacing: 2,
        }}
      >
        → OPEN THE APP
      </Link>
    </section>
  )
}
