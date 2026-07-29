'use client'

import { useEffect, useState } from 'react'
import type { Verdict, VerdictLabel } from '@/lib/types'
import { FreshnessBadge } from './FreshnessBadge'
import { RhetoricBadge } from './RhetoricBadge'
import { CounterEvidence } from './CounterEvidence'

const LABEL_COLOR: Record<VerdictLabel, string> = {
  VERIFIED: 'var(--teal)',
  FALSE: 'var(--coral)',
  MISLEADING: 'var(--amber)',
  UNVERIFIED: 'var(--gray-v)',
  CONTESTED: 'var(--violet)',
}

const SPEAKER_COLOR: Record<string, string> = {
  A: 'var(--speaker-a)',
  B: 'var(--speaker-b)',
  C: 'var(--speaker-c)',
  D: 'var(--speaker-d)',
}

function ConfidenceBar({ pct, label }: { pct: number; label: VerdictLabel }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 40)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div
      style={{
        marginTop: 12,
        height: 1,
        background: 'var(--border)',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${width}%`,
          background: LABEL_COLOR[label],
          transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}

function VerdictItem({
  verdict,
  onApprove,
}: {
  verdict: Verdict
  onApprove: (id: string, approved: boolean) => void
}) {
  const color = LABEL_COLOR[verdict.label]
  const speakerColor = SPEAKER_COLOR[verdict.speaker] ?? 'var(--text)'
  const firstSource = verdict.evidence[0]?.source ?? 'no source'
  const isContested = verdict.label === 'CONTESTED'
  const counterEvidence = verdict.counterEvidence ?? []

  return (
    <article
      style={{
        padding: '22px 14px',
        borderBottom: '1px solid var(--border)',
        borderLeft: isContested ? `2px solid ${color}` : 'none',
        paddingLeft: isContested ? 18 : 14,
        animation: 'fadeUp 0.5s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div
          style={{
            fontSize: 35,
            fontWeight: 500,
            letterSpacing: '-0.5px',
            color,
          }}
        >
          {isContested ? '⚡ CONTESTED' : verdict.label}
        </div>
        <div
          style={{
            fontSize: 25,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            opacity: 0.15,
          }}
        >
          {verdict.confidencePct}%
        </div>
      </div>
      <p style={{ marginTop: 10, fontSize: 16, color: 'var(--text)' }}>
        &ldquo;{verdict.claimText}&rdquo;
      </p>
      <div
        style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: 1.5,
          color: 'var(--text-muted)',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ color: speakerColor }}>SPEAKER {verdict.speaker}</span>
        <span>·</span>
        <span>{verdict.timestamp}</span>
        <span>·</span>
        <span>VIA {firstSource.toUpperCase()}</span>
        <span>·</span>
        <span>{verdict.iterationsUsed} ITER</span>
        <FreshnessBadge verdict={verdict} />
        <RhetoricBadge pattern={verdict.rhetoricalPattern} />
      </div>
      <p style={{ marginTop: 10, fontSize: 15, color: '#777', lineHeight: 1.65 }}>
        {verdict.explanation}
      </p>

      <ConfidenceBar pct={verdict.confidencePct} label={verdict.label} />

      {(isContested || counterEvidence.length > 0) && (
        <CounterEvidence supporting={verdict.evidence} counter={counterEvidence} />
      )}

      {verdict.approvalRequired && verdict.approved === null && (
        <div
          style={{
            marginTop: 14,
            padding: '12px 14px',
            border: '1px solid rgba(255,171,0,0.4)',
            background: 'var(--amber-dim)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: 1.5,
              color: 'var(--amber)',
              marginBottom: 10,
            }}
          >
            CONFIDENCE 40–70% · REVIEW REQUIRED
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => onApprove(verdict.id, true)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid var(--amber)',
                color: 'var(--amber)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: 1.5,
                cursor: 'pointer',
              }}
            >
              CONFIRM VERDICT
            </button>
            <button
              type="button"
              onClick={() => onApprove(verdict.id, false)}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: '1px solid var(--coral)',
                color: 'var(--coral)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: 1.5,
                cursor: 'pointer',
              }}
            >
              OVERRIDE
            </button>
          </div>
        </div>
      )}
      {verdict.approved !== null && (
        <div
          style={{
            marginTop: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: 1.5,
            color: verdict.approved ? 'var(--teal)' : 'var(--coral)',
          }}
        >
          [{verdict.approved ? 'CONFIRMED' : 'OVERRIDDEN'}]
        </div>
      )}
    </article>
  )
}

export function VerdictFeed({
  verdicts,
  onApprove,
}: {
  verdicts: Verdict[]
  onApprove: (id: string, approved: boolean) => void
}) {
  if (!verdicts.length) {
    return (
      <div
        style={{
          padding: '36px 0',
          color: 'var(--text-dim)',
          fontSize: 15,
          fontFamily: 'var(--font-mono)',
          letterSpacing: 1.5,
        }}
      >
        NO VERDICTS YET…
      </div>
    )
  }
  return (
    <div role="region" aria-live="polite" aria-label="Verdict stream">
      {verdicts.map((v) => (
        <VerdictItem key={v.id} verdict={v} onApprove={onApprove} />
      ))}
    </div>
  )
}
