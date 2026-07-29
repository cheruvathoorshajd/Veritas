'use client'

import type { RhetoricalPattern } from '@/lib/types'

const LABELS: Record<RhetoricalPattern, string> = {
  appeal_to_authority: 'APPEAL TO AUTHORITY',
  false_dichotomy: 'FALSE DICHOTOMY',
  slippery_slope: 'SLIPPERY SLOPE',
  ad_hominem: 'AD HOMINEM',
  straw_man: 'STRAW MAN',
  appeal_to_fear: 'APPEAL TO FEAR',
  cherry_picking: 'CHERRY-PICKING',
  gish_gallop: 'GISH GALLOP',
  moving_goalposts: 'MOVING GOALPOSTS',
  appeal_to_nature: 'APPEAL TO NATURE',
  bandwagon: 'BANDWAGON',
}

/**
 * Outlined-pill badge for a detected rhetorical pattern on a verdict.
 * Returns null when the pattern is null or undefined — never renders an
 * empty placeholder.
 */
export function RhetoricBadge({
  pattern,
}: {
  pattern: RhetoricalPattern | null | undefined
}) {
  if (!pattern) return null
  const label = LABELS[pattern] ?? pattern.replace(/_/g, ' ').toUpperCase()
  return (
    <span
      aria-label={`Rhetorical pattern detected: ${label}`}
      title="Detected rhetorical pattern. Logical fallacies don't make a claim factually false — they describe how it's argued."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        border: '1px solid var(--text-muted)',
        color: 'var(--text)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 2,
        lineHeight: 1,
        background: 'transparent',
        borderRadius: 99,
      }}
    >
      {label}
    </span>
  )
}
