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
  'Four input formats — live mic, Word .docx, PDF, pasted text — flow into one pipeline.',
  'Per-speaker attribution via AssemblyAI diarization (up to 26 labels); single- or multi-speaker mic mode.',
  'Open-domain Web RAG over Tavily, Wikipedia, and PolitiFact — three live sources, fired in parallel.',
  'Four-agent LangGraph orchestration: extract → ReAct verify → synthesise verdict → per-speaker report.',
  'LLM resilience — Gemini 2.0 Flash with automatic Groq Llama 3.3 fallback on quota errors.',
  'Human-in-the-loop approval for verdicts in the 40–70% confidence band.',
  'Real-time SSE pipeline — every stage, claim, and verdict streamed to the browser as it happens.',
  'Rhetorical-pattern detection on every claim — eleven classical fallacies flagged inline.',
  'Confidence decay tuned per claim type — statistical claims age faster than historical facts.',
  'Cross-session speaker credibility — reputations persist between recordings.',
  'Downloadable HTML report (browser-printable to PDF) with persistent share link via Supabase.',
  'Runs entirely on free tiers — $0 infrastructure, deploys to Vercel in one command.',
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
        <span className="num">(04)</span>
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
