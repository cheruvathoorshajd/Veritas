'use client'

import { useReveal } from './useReveal'

interface Row {
  num: string
  title: string
  desc: string
  tag: string
  tagColor: 'teal' | 'amber' | 'coral' | 'violet'
}

const ROWS: Row[] = [
  {
    num: '01',
    title: 'Claim genealogy',
    desc: 'A force-directed graph of every claim made across the session, linked by shared named entities. See which claims hang together — which support the same world-view, which contradict each other — instead of reading them as an undifferentiated list.',
    tag: 'shared-entity Jaccard · phase 4A',
    tagColor: 'teal',
  },
  {
    num: '02',
    title: 'Rhetoric pattern detection',
    desc: 'Eleven classical patterns flagged inline on each claim. Appeal to authority, false dichotomy, slippery slope, ad hominem, straw man, appeal to fear, cherry-picking, Gish gallop, moving goalposts, appeal to nature, bandwagon. LLM output is clamped to the enum — adversarial input cannot invent a new pattern.',
    tag: '11 patterns · enum-clamped',
    tagColor: 'amber',
  },
  {
    num: '03',
    title: 'Confidence decay',
    desc: 'Statistical claims age fast — last month’s unemployment number means something different from 2019’s. Every verdict’s confidence is multiplied by a freshness factor whose half-life is tuned to the claim type. Old statistics fade; historical facts never decay.',
    tag: 'per-claim half-life table · phase 4C',
    tagColor: 'violet',
  },
  {
    num: '04',
    title: 'Domain credibility priors',
    desc: 'Evidence from .gov, .edu, IPCC, WHO, NIH and major newswires is anchored to a fixed credibility tier the LLM is not allowed to override. Removes one full LLM judgement per evidence item and stops a random blog from getting equal weight as primary government data.',
    tag: 'static priors · LLM-locked',
    tagColor: 'teal',
  },
  {
    num: '05',
    title: 'Cross-session speaker credibility',
    desc: 'Every speaker carries a rolling credibility score that updates across sessions — the more of their claims that hold up, the higher it climbs. Persists in Supabase, so the same speaker keeps their reputation between recordings. The system has memory.',
    tag: 'rolling score · supabase-backed',
    tagColor: 'coral',
  },
]

const TAG_STYLE: Record<Row['tagColor'], React.CSSProperties> = {
  teal: { color: 'var(--teal)', borderColor: 'rgba(0,217,139,0.35)' },
  amber: { color: 'var(--amber)', borderColor: 'rgba(255,171,0,0.35)' },
  coral: { color: 'var(--coral)', borderColor: 'rgba(255,61,46,0.35)' },
  violet: { color: 'var(--violet)', borderColor: 'rgba(167,139,250,0.35)' },
}

export function BeyondBaseline() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="beyond"
      style={{ padding: '120px 48px', borderBottom: '1px solid var(--border)' }}
    >
      <div className="section-label reveal">
        <span className="num">(03)</span>
        <span>BEYOND THE BASELINE</span>
      </div>

      <p
        className="reveal delay-1"
        style={{
          fontSize: 30,
          lineHeight: 1.4,
          maxWidth: 760,
          margin: '0 0 80px',
          color: 'var(--text)',
        }}
      >
        Five things most fact-checkers don&rsquo;t bother with.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {ROWS.map((r, i) => (
          <div
            key={r.num}
            className={`reveal delay-${(i % 5) + 1}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 220px',
              gap: 32,
              alignItems: 'baseline',
              padding: '34px 0',
              borderTop: '1px solid var(--border)',
              borderBottom:
                i === ROWS.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--text-dim)',
                letterSpacing: 2,
              }}
            >
              {r.num}
            </div>
            <div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  letterSpacing: -0.3,
                  marginBottom: 12,
                  color: 'var(--text)',
                }}
              >
                {r.title}
              </div>
              <p
                style={{
                  fontSize: 16,
                  color: '#666',
                  lineHeight: 1.6,
                  maxWidth: 720,
                }}
              >
                {r.desc}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  border: '1px solid',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: 1.5,
                  whiteSpace: 'nowrap',
                  ...TAG_STYLE[r.tagColor],
                }}
              >
                {r.tag.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
