'use client'

import { useReveal } from './useReveal'

const STATS = [
  { k: '6×', v: 'faster false news spreads than truth' },
  { k: '$0', v: 'cost of every existing free consumer fact-checker that actually works' },
  { k: '100%', v: 'of live fact-checking tools require enterprise contracts' },
  { k: '0', v: 'public tools that tell you which speaker made a false claim' },
]

export function Problem() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="problem"
      style={{
        padding: '120px 48px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="section-label reveal">
        <span className="num">(00)</span>
        <span>THE PROBLEM</span>
      </div>
      <blockquote
        className="reveal delay-1"
        style={{
          fontSize: 30,
          lineHeight: 1.4,
          maxWidth: 760,
          margin: '0 0 80px',
          color: 'var(--text)',
        }}
      >
        Fact-checking tools exist — but none of them are built for you.
      </blockquote>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 40,
        }}
      >
        {STATS.map((s, i) => (
          <div
            key={s.k}
            className={`reveal delay-${i + 1}`}
            style={{
              borderTop: i === 0 ? '1px solid var(--coral)' : '1px solid var(--border)',
              paddingTop: 22,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 64,
                fontWeight: 500,
                letterSpacing: '-2px',
                color: i === 0 ? 'var(--coral)' : 'var(--text)',
                lineHeight: 1,
                marginBottom: 14,
              }}
            >
              {s.k}
            </div>
            <div
              style={{
                fontSize: 15,
                color: 'var(--text-muted)',
                lineHeight: 1.5,
              }}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
