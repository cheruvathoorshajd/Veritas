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
    title: 'Multi-input unified',
    desc: 'Mic, file, and text paste flow through one pipeline — no switching tools between formats.',
    tag: 'AssemblyAI + Web Speech',
    tagColor: 'teal',
  },
  {
    num: '02',
    title: 'Per-speaker attribution',
    desc: 'AssemblyAI diarization attributes every false claim to the person who said it.',
    tag: 'AssemblyAI diarization',
    tagColor: 'teal',
  },
  {
    num: '03',
    title: 'Open-domain Web RAG',
    desc: 'Live internet retrieval, never stale — Tavily, Wikipedia, and PolitiFact in parallel.',
    tag: 'Tavily + Wikipedia + PolitiFact',
    tagColor: 'amber',
  },
  {
    num: '04',
    title: 'Multi-agent ReAct',
    desc: 'Four specialised agents: extract, verify, synthesise, report — orchestrated in LangGraph.',
    tag: 'LangGraph · Gemini Flash',
    tagColor: 'none',
  },
  {
    num: '05',
    title: 'Completely free',
    desc: 'Runs entirely on free tiers. Deployable to Vercel with $0 infrastructure cost.',
    tag: '$0 / month forever',
    tagColor: 'coral',
  },
  {
    num: '06',
    title: 'Exportable reports',
    desc: 'Per-speaker accuracy, every verdict sourced, every claim timestamped, sharable as link or PDF.',
    tag: 'PDF · share link',
    tagColor: 'none',
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
