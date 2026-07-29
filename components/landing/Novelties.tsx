'use client'

import { useReveal } from './useReveal'

type TagColor = 'teal' | 'amber' | 'coral' | 'none'

interface Novelty {
  num: string
  title: string
  desc: string
  tag: string
  tagColor: TagColor
}

const NOVELTIES: Novelty[] = [
  {
    num: '01',
    title: 'Three inputs, one pipeline',
    desc: 'Mic streaming, Word (.docx) and PDF upload, or pasted text — all funnel into the same agent graph. Switch single-speaker vs multi-speaker mic mode at click time.',
    tag: 'AssemblyAI · mammoth · pdf-parse',
    tagColor: 'teal',
  },
  {
    num: '02',
    title: 'Per-speaker attribution',
    desc: 'AssemblyAI diarization labels live audio. Documents and pasted text honour Speaker A: / Speaker B: prefixes. Every claim, verdict, and accuracy score is bound to the person who said it.',
    tag: 'Up to 26 speakers (A–Z)',
    tagColor: 'teal',
  },
  {
    num: '03',
    title: 'Open-domain Web RAG',
    desc: 'Live internet retrieval, never stale — three sources fired in parallel for every search query, then deduplicated, ranked, and compressed before reaching the LLM.',
    tag: 'Tavily + Wikipedia + PolitiFact',
    tagColor: 'amber',
  },
  {
    num: '04',
    title: 'Four-agent LangGraph',
    desc: 'A StateGraph orchestrates four specialised agents — claim extraction, ReAct verification, verdict synthesis, per-speaker report — with conditional routing between them.',
    tag: 'LangGraph · StateGraph',
    tagColor: 'none',
  },
  {
    num: '05',
    title: 'ReAct verification loop',
    desc: 'Each claim is verified by reasoning over evidence, issuing follow-up search queries when the LLM judges the evidence insufficient, then synthesising a labelled verdict with confidence.',
    tag: 'reason → search → repeat',
    tagColor: 'amber',
  },
  {
    num: '06',
    title: 'LLM resilience',
    desc: 'Gemini 2.0 Flash by default. On quota or rate-limit errors the pipeline transparently fails over to Groq Llama 3.3 70B mid-run — no dropped claims, no user-visible error.',
    tag: 'Gemini → Groq auto-fallback',
    tagColor: 'none',
  },
  {
    num: '07',
    title: 'Human-in-the-loop approval',
    desc: 'Verdicts in the borderline 40–70% confidence band are flagged for human review. Approve or reject inline; decisions persist to the session for the exported report.',
    tag: 'Approval band: 40–70%',
    tagColor: 'amber',
  },
  {
    num: '08',
    title: 'Real-time SSE streaming',
    desc: 'A single Server-Sent Events channel streams every pipeline event — stage changes, transcript lines, detected claims, search activity, verdicts, speaker stats — straight to the browser.',
    tag: 'SSE · 9 event types',
    tagColor: 'teal',
  },
  {
    num: '09',
    title: 'Exportable HTML reports',
    desc: 'One click downloads a self-contained HTML report grouped by speaker, with every verdict sourced and every claim timestamped. Browser-printable to PDF; persistent share link when Supabase is configured.',
    tag: 'HTML · print-to-PDF · share link',
    tagColor: 'none',
  },
  {
    num: '10',
    title: '$0 infrastructure',
    desc: 'Built end-to-end on free tiers — AssemblyAI, Gemini, Groq, Tavily, Supabase, Vercel. No paid APIs, no enterprise contracts, no credit card required.',
    tag: '$0 / month forever',
    tagColor: 'coral',
  },
]

const TAG_STYLE: Record<TagColor, React.CSSProperties> = {
  teal: { color: 'var(--teal)', borderColor: 'rgba(0,217,139,0.35)' },
  amber: { color: 'var(--amber)', borderColor: 'rgba(255,171,0,0.35)' },
  coral: { color: 'var(--coral)', borderColor: 'rgba(255,61,46,0.35)' },
  none: { color: 'var(--text-muted)', borderColor: 'var(--border-bright)' },
}

export function Novelties() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="novelties"
      style={{ padding: '120px 48px', borderBottom: '1px solid var(--border)' }}
    >
      <div className="section-label reveal">
        <span className="num">(01)</span>
        <span>WHAT MAKES VERITAS DIFFERENT</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '60px 80px',
          marginTop: 60,
        }}
      >
        {NOVELTIES.map((n, i) => (
          <div
            key={n.num}
            className={`reveal delay-${(i % 6) + 1}`}
            style={{ display: 'flex', gap: 24 }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                color: 'var(--text-dim)',
                letterSpacing: 2,
                paddingTop: 6,
              }}
            >
              {n.num}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 500,
                  marginBottom: 10,
                  color: 'var(--text)',
                }}
              >
                {n.title}
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: '#666',
                  lineHeight: 1.65,
                  marginBottom: 14,
                }}
              >
                {n.desc}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  border: '1px solid',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: 1.5,
                  ...TAG_STYLE[n.tagColor],
                }}
              >
                {n.tag.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
