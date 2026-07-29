'use client'

import { useReveal } from './useReveal'

export function Hero() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="hero"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '28px 48px 80px',
        borderBottom: '1px solid var(--border)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <nav
        className="reveal"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 40,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 18,
            letterSpacing: '4px',
          }}
        >
          VERITAS
        </div>
        <div
          style={{
            display: 'flex',
            gap: 28,
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: '2px',
            color: 'var(--text-muted)',
          }}
        >
          <a href="#novelties" style={{ color: 'inherit', textDecoration: 'none' }}>
            NOVELTY
          </a>
          <a href="#pipeline" style={{ color: 'inherit', textDecoration: 'none' }}>
            PIPELINE
          </a>
          <a href="#product" style={{ color: 'inherit', textDecoration: 'none' }}>
            PRODUCT
          </a>
        </div>
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1
          className="reveal delay-1"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 94,
            lineHeight: 0.95,
            letterSpacing: '-3px',
            fontWeight: 500,
            margin: '0 0 48px',
          }}
        >
          THE
          <br />
          TRUTH
          <br />
          <span style={{ color: 'var(--coral)' }}>MACHINE.</span>
        </h1>

        <div
          className="reveal delay-2"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 60,
            maxWidth: 1100,
          }}
        >
          <p style={{ fontSize: 23, lineHeight: 1.45, color: 'var(--text)' }}>
            Every conversation, document, or transcript —
            <br />
            attributed, verified, and sourced in real time.
          </p>
          <div style={{ color: 'var(--text-muted)', fontSize: 16, lineHeight: 1.7 }}>
            <p style={{ marginBottom: 22 }}>
              Mic streaming, Word and PDF uploads, or pasted text — all flow through a four-agent
              LangGraph pipeline that extracts every verifiable claim, runs a ReAct loop over
              Tavily, Wikipedia, and PolitiFact, and streams per-speaker verdicts back over SSE.
              Gemini with Groq auto-fallback. Built for the open internet, $0 infrastructure.
            </p>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <a
                href="#product"
                style={{
                  display: 'inline-block',
                  padding: '10px 22px',
                  background: 'var(--text)',
                  color: 'var(--bg)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  letterSpacing: '2px',
                }}
              >
                SEE THE PRODUCT →
              </a>
              <a
                href="#pipeline"
                style={{
                  display: 'inline-block',
                  padding: '10px 22px',
                  border: '1px solid var(--border-bright)',
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  letterSpacing: '2px',
                }}
              >
                HOW IT WORKS
              </a>
            </div>
          </div>
        </div>
      </div>

      <div
        className="reveal delay-3"
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 18,
          display: 'flex',
          gap: 24,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: '1.5px',
          color: 'var(--text-dim)',
        }}
      >
        <span>4 AGENTS</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>6 PIPELINE STAGES</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>3 RETRIEVAL SOURCES</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>SSE STREAMING</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        <span>$0 / MONTH</span>
      </div>
    </section>
  )
}
