'use client'

import type { ExtractedClaim, TranscriptLine } from '@/lib/types'

const SPEAKER_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: '#101828', color: '#5A8FD6', border: '#1A2A50' },
  B: { bg: '#081612', color: '#46B88A', border: '#0F2E20' },
  C: { bg: '#17101E', color: '#C084FC', border: '#2A1A3A' },
  D: { bg: '#1F1208', color: '#FB923C', border: '#3A2512' },
}

function speakerStyle(id: string) {
  return SPEAKER_STYLES[id.toUpperCase()] ?? SPEAKER_STYLES.A
}

export function TranscriptFeed({
  lines,
  claims,
}: {
  lines: TranscriptLine[]
  claims: ExtractedClaim[]
}) {
  if (!lines.length) {
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
        AWAITING INPUT…
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 20 }}>
      {lines.map((l) => {
        const s = speakerStyle(l.speaker)
        const matchingClaims = claims.filter(
          (c) => c.speaker === l.speaker && c.timestamp === l.timestamp,
        )
        return (
          <div key={l.id} style={{ animation: 'fadeUp 0.35s ease' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '52px 1fr 56px',
                alignItems: 'baseline',
                gap: 14,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 8px',
                  background: s.bg,
                  color: s.color,
                  border: `1px solid ${s.border}`,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  letterSpacing: 1.5,
                  textAlign: 'center',
                }}
              >
                {l.speaker}
              </span>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: '#888' }}>{l.text}</p>
              <span
                style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  color: '#222',
                }}
              >
                {l.timestamp}
              </span>
            </div>
            {matchingClaims.map((c) => (
              <div
                key={c.id}
                style={{
                  marginLeft: 66,
                  marginTop: 6,
                  padding: '6px 12px',
                  borderLeft: '1px solid var(--coral)',
                  background: 'var(--coral-dim)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  letterSpacing: 1,
                  color: 'var(--coral)',
                  animation: 'fadeUp 0.45s ease',
                }}
              >
                <span style={{ opacity: 0.7 }}>[CLAIM DETECTED]</span>{' '}
                <span style={{ color: 'var(--text)', letterSpacing: 0.2 }}>
                  {c.claimText}
                </span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
