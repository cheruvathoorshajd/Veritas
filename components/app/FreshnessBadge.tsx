'use client'

import type { Verdict } from '@/lib/types'
import { computeFreshness } from '@/lib/decay/freshness'

/**
 * Renders a small "Stale · Xd ago" badge when a verdict's freshness has
 * decayed below 0.5. Returns null otherwise — the UI is unobtrusive for
 * recent, historical, or normative claims (none of which can ever be
 * stale by design).
 */
export function FreshnessBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict.producedAt) return null
  const info = computeFreshness(verdict)
  if (!info.isStale) return null
  const days = Math.round(info.daysElapsed)
  return (
    <span
      aria-label={`Stale verdict, ${days} days old`}
      title={`Verdict produced ${days} days ago · ${verdict.claimType ?? 'statistical'} half-life ${info.halfLifeDays}d`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 8px',
        border: '1px solid var(--amber)',
        color: 'var(--amber)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: 1.5,
        lineHeight: 1,
        background: 'transparent',
      }}
    >
      <span aria-hidden>⚠</span>
      STALE · {days}D AGO
    </span>
  )
}
