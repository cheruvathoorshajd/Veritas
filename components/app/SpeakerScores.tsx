'use client'

import type { Speaker, Verdict } from '@/lib/types'
import { CredibilityBadge } from './CredibilityBadge'
import { computeCredibilityBySpeaker } from '@/lib/credibility/score'

const SPEAKER_COLOR: Record<string, string> = {
  A: 'var(--speaker-a)',
  B: 'var(--speaker-b)',
  C: 'var(--speaker-c)',
  D: 'var(--speaker-d)',
}

export function SpeakerScores({
  speakers,
  verdicts = [],
}: {
  speakers: Speaker[]
  verdicts?: Verdict[]
}) {
  if (!speakers.length) return null
  const credibilityByLabel = computeCredibilityBySpeaker(verdicts)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(speakers.length, 4)}, 1fr)`,
        gap: 32,
        padding: '30px 0',
      }}
    >
      {speakers.map((s) => {
        const label = SPEAKER_COLOR[s.id] ?? 'var(--text)'
        const pctColor = s.accuracyPct >= 60 ? 'var(--teal)' : 'var(--coral)'
        const credibility = credibilityByLabel.get(s.id)
        return (
          <div key={s.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: 1.5,
                color: label,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span>
                {s.label.toUpperCase()} · {s.claimsTotal} CLAIM{s.claimsTotal === 1 ? '' : 'S'}
              </span>
              {credibility && <CredibilityBadge breakdown={credibility} size="sm" />}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 51,
                fontWeight: 500,
                letterSpacing: '-3px',
                color: pctColor,
                lineHeight: 1,
                marginBottom: 10,
              }}
            >
              {s.accuracyPct}%
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: '#333',
                letterSpacing: 1.2,
              }}
            >
              {s.claimsVerified}/{s.claimsTotal} ACCURATE
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: 1.5,
                color: 'var(--text-muted)',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {s.claimsFalse > 0 && (
                <span style={{ color: 'var(--coral)' }}>{s.claimsFalse} FALSE</span>
              )}
              {s.claimsMisleading > 0 && (
                <span style={{ color: 'var(--amber)' }}>{s.claimsMisleading} MISLEADING</span>
              )}
              {(s.claimsContested ?? 0) > 0 && (
                <span style={{ color: 'var(--violet)' }}>{s.claimsContested} CONTESTED</span>
              )}
              {s.claimsUnverified > 0 && (
                <span style={{ color: 'var(--gray-v)' }}>{s.claimsUnverified} UNVERIFIED</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
