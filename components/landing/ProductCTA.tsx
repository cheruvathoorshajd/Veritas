'use client'

import { useReveal } from './useReveal'
import { useTransitionNavigate } from '@/components/PageTransition'

export function ProductCTA() {
  const ref = useReveal<HTMLElement>()
  const navigate = useTransitionNavigate()
  return (
    <section
      ref={ref}
      id="product"
      style={{ padding: '140px 48px' }}
    >
      <div className="section-label reveal">
        <span className="num">(05)</span>
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
        Stream from the mic, drop a Word doc or PDF, or paste a transcript. Watch claims get
        extracted, verified against the live web, and scored per speaker — in real time.
        Download the report when you&rsquo;re done.
      </p>
      <a
        href="/app"
        onClick={(e) => {
          e.preventDefault()
          navigate('/app')
        }}
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
      </a>
    </section>
  )
}
