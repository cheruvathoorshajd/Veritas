'use client'

import { useReveal } from './useReveal'

const FIELD = [
  'Full Fact / Snopes — journalist-only workflows, no live conversation support.',
  'Google Fact Check — index lookup, not live transcription.',
  'Logically — enterprise-only, $40k+ contracts.',
  'NewsGuard — browser plugin for publisher ratings, not claims.',
  'Originality.ai — plagiarism and AI-detection, not fact-checking.',
  'Academic demos — FEVER / CheckThat! benchmarks, never deployed as product.',
]

const VERITAS = [
  'Live mic + file + text paste — one product, every surface.',
  'Per-speaker attribution with accuracy scores and exportable reports.',
  'Open-domain Web RAG over real sources, never a stale corpus.',
  'Multi-agent ReAct loop with human-in-the-loop approval on borderline calls.',
  'Runs entirely on free tiers — $0 infra, open source.',
  'Deploys to Vercel in one command, anyone can self-host.',
]

function Item({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 7 }} />
      <p style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.55 }}>{text}</p>
    </div>
  )
}

export function Market() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="market"
      style={{ padding: '120px 48px', borderBottom: '1px solid var(--border)' }}
    >
      <div className="section-label reveal">
        <span className="num">(03)</span>
        <span>VS. THE MARKET</span>
      </div>

      <div
        className="reveal delay-1"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 60,
          marginTop: 60,
        }}
      >
        <div style={{ borderTop: '2px solid var(--coral)', paddingTop: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 2, color: 'var(--coral)', marginBottom: 20 }}>
            THE FIELD
          </div>
          {FIELD.map((t) => (
            <Item key={t} color="var(--coral)" text={t} />
          ))}
        </div>
        <div style={{ borderTop: '2px solid var(--teal)', paddingTop: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: 2, color: 'var(--teal)', marginBottom: 20 }}>
            VERITAS
          </div>
          {VERITAS.map((t) => (
            <Item key={t} color="var(--teal)" text={t} />
          ))}
        </div>
      </div>
    </section>
  )
}
