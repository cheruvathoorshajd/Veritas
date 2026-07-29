'use client'

import type { CredibilityBreakdown } from '@/lib/credibility/score'

const TIER_COLOR: Record<string, string> = {
  green: 'var(--teal)',
  amber: 'var(--amber)',
  red: 'var(--coral)',
}

/**
 * Small shield-style badge that renders next to a speaker name. Reads
 * from a `CredibilityBreakdown` (see `lib/credibility/score.ts`).
 * Returns null when there's no signal — never renders an empty badge.
 */
export function CredibilityBadge({
  breakdown,
  size = 'sm',
}: {
  breakdown: CredibilityBreakdown
  size?: 'sm' | 'md'
}) {
  if (breakdown.tier === null || breakdown.score === null) return null
  const color = TIER_COLOR[breakdown.tier] ?? 'var(--text)'
  const pct = Math.round(breakdown.score * 100)
  const fontSize = size === 'md' ? 12 : 10
  const padding = size === 'md' ? '4px 9px' : '3px 7px'
  return (
    <span
      aria-label={`Credibility ${pct}%`}
      title={`Credibility ${pct}% · ${breakdown.verified} verified · ${breakdown.false_} false · ${breakdown.misleading} misleading · ${breakdown.contested} contested`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding,
        border: `1px solid ${color}`,
        color,
        fontFamily: 'var(--font-mono)',
        fontSize,
        letterSpacing: 1.5,
        background: 'transparent',
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color }} />
      {pct}%
    </span>
  )
}
