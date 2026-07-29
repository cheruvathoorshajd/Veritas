/**
 * Phase 4D — Speaker credibility score.
 *
 * Tracks per-speaker accuracy as a rolling number across sessions.
 * The formula is intentionally simple — weighted by verdict label —
 * because the consumer (a UI shield badge) only needs three buckets:
 * green / amber / red.
 *
 *   credibility = (V * 1.0 + M * 0.3 + F * 0.0 + C * 0.3) / total
 *
 * where V/M/F/C are verified, misleading, false, contested counts.
 * UNVERIFIED claims don't contribute — they're not evidence of
 * accuracy either way. Returns `null` when total is 0 (no badge).
 */

import type { Verdict, VerdictLabel } from '@/lib/types'

export type CredibilityTier = 'green' | 'amber' | 'red'

export interface CredibilityBreakdown {
  total: number
  verified: number
  false_: number
  misleading: number
  contested: number
  unverified: number
  score: number | null
  tier: CredibilityTier | null
}

function tierForScore(score: number): CredibilityTier {
  if (score >= 0.8) return 'green'
  if (score >= 0.5) return 'amber'
  return 'red'
}

/**
 * Compute a credibility breakdown for a single speaker from a list of
 * their verdicts. Pure function — caller is responsible for filtering
 * the verdicts to one speaker.
 */
export function computeCredibility(
  verdicts: Pick<Verdict, 'label'>[],
): CredibilityBreakdown {
  const counts: Record<VerdictLabel, number> = {
    VERIFIED: 0,
    FALSE: 0,
    MISLEADING: 0,
    UNVERIFIED: 0,
    CONTESTED: 0,
  }
  for (const v of verdicts) counts[v.label] += 1

  const scoredTotal =
    counts.VERIFIED + counts.FALSE + counts.MISLEADING + counts.CONTESTED
  if (scoredTotal === 0) {
    return {
      total: verdicts.length,
      verified: counts.VERIFIED,
      false_: counts.FALSE,
      misleading: counts.MISLEADING,
      contested: counts.CONTESTED,
      unverified: counts.UNVERIFIED,
      score: null,
      tier: null,
    }
  }
  const score =
    (counts.VERIFIED * 1.0 +
      counts.MISLEADING * 0.3 +
      counts.CONTESTED * 0.3 +
      counts.FALSE * 0.0) /
    scoredTotal
  return {
    total: verdicts.length,
    verified: counts.VERIFIED,
    false_: counts.FALSE,
    misleading: counts.MISLEADING,
    contested: counts.CONTESTED,
    unverified: counts.UNVERIFIED,
    score,
    tier: tierForScore(score),
  }
}

/**
 * Group verdicts by speaker label and compute a credibility breakdown
 * for each. Returns a Map keyed by speaker label.
 */
export function computeCredibilityBySpeaker(
  verdicts: Pick<Verdict, 'speaker' | 'label'>[],
): Map<string, CredibilityBreakdown> {
  const grouped = new Map<string, Pick<Verdict, 'label'>[]>()
  for (const v of verdicts) {
    const arr = grouped.get(v.speaker) ?? []
    arr.push(v)
    grouped.set(v.speaker, arr)
  }
  const out = new Map<string, CredibilityBreakdown>()
  for (const [speaker, vs] of grouped) {
    out.set(speaker, computeCredibility(vs))
  }
  return out
}
