/**
 * Phase 4C — Confidence Decay Engine.
 *
 * Verdicts aren't permanent. A statistical claim made on a 2-year-old
 * unemployment number can be invalidated by a single new BLS release;
 * a historical fact ("Berlin Wall fell in 1989") never decays. This module
 * encodes the truth half-life per claim type and exposes pure functions
 * the UI uses to render staleness badges and decide whether to re-verify.
 */

import type { ClaimType, FreshnessInfo, Verdict } from '@/lib/types'

/**
 * Half-life in days per claim type. `null` means the claim category never
 * decays. The numbers come from the sprint spec's truth-half-life table.
 */
export const HALF_LIFE_DAYS: Record<ClaimType, number | null> = {
  statistical: 30,
  predictive: 0, // handled specially — see computeFreshness
  political_position: 7,
  scientific_consensus: 365,
  causal: 180,
  historical: null,
  normative: null,
}

const MS_PER_DAY = 86_400_000

/**
 * Stale threshold — verdicts with freshness < this trigger UI warnings.
 * 0.5 corresponds to "one half-life elapsed".
 */
export const STALE_THRESHOLD = 0.5

/**
 * Compute the freshness multiplier for a verdict.
 *
 * - For decaying types: `freshness = exp(-elapsed / half_life)` (0..1).
 * - For non-decaying types (historical, normative): returns 1.0 always.
 * - For predictive: returns 0 once the predicted date is past, 1 otherwise.
 *
 * `producedAt` falls back to `new Date()` when omitted (i.e., no decay yet).
 * `now` is injectable for testing.
 */
export function computeFreshness(
  verdict: Pick<Verdict, 'producedAt' | 'claimType'>,
  predictedDate?: Date | null,
  now: Date = new Date(),
): FreshnessInfo {
  const producedAtIso = verdict.producedAt ?? now.toISOString()
  const producedAt = new Date(producedAtIso)
  const elapsedMs = Math.max(0, now.getTime() - producedAt.getTime())
  const daysElapsed = elapsedMs / MS_PER_DAY

  const claimType: ClaimType | undefined = verdict.claimType
  // Default behaviour when claimType is missing: treat as `statistical`
  // (the most common decaying type for live conversational claims).
  const effectiveType: ClaimType = claimType ?? 'statistical'
  const halfLife = HALF_LIFE_DAYS[effectiveType]

  if (halfLife === null) {
    return {
      freshness: 1,
      isStale: false,
      daysElapsed,
      halfLifeDays: null,
    }
  }

  if (effectiveType === 'predictive') {
    const cutoff = predictedDate ?? producedAt
    const freshness = now.getTime() < cutoff.getTime() ? 1 : 0
    return {
      freshness,
      isStale: freshness === 0,
      daysElapsed,
      halfLifeDays: 0,
    }
  }

  const freshness = Math.exp(-daysElapsed / halfLife)
  return {
    freshness,
    isStale: freshness < STALE_THRESHOLD,
    daysElapsed,
    halfLifeDays: halfLife,
  }
}

/**
 * Aggregate freshness across a list of verdicts. Used to power the
 * "⚠ Stale verdicts detected" banner on the saved-session view.
 */
export function summariseFreshness(
  verdicts: Pick<Verdict, 'producedAt' | 'claimType'>[],
  now: Date = new Date(),
): { stale: number; total: number; hasStale: boolean } {
  let stale = 0
  for (const v of verdicts) {
    if (computeFreshness(v, null, now).isStale) stale += 1
  }
  return { stale, total: verdicts.length, hasStale: stale > 0 }
}
