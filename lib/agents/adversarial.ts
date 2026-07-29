/**
 * Phase 4E — Adversarial Evidence Mode.
 *
 * After a VERIFIED verdict, run a second search pass that actively looks
 * for disconfirmation. If credible counter-evidence is found, downgrade
 * the verdict to CONTESTED (violet). All other verdict labels skip this
 * pass — FALSE/MISLEADING are already negative, UNVERIFIED has no claim
 * to challenge, and CONTESTED only emerges from this very function.
 *
 * Source credibility piggybacks on the existing `domainCredibility`
 * table — no need to invent a separate scoring rubric for adversarial
 * evidence.
 */

import type { LLM } from '@/lib/agents/llm'
import type { Evidence, Verdict } from '@/lib/types'
import { searchTavilyWithStatus } from '@/lib/retrieval/tavily'
import { compressDocument } from '@/lib/retrieval/compress'
import { classifyNli } from '@/lib/nlp/nli'

const COUNTER_TERMS = ['criticism', 'debunked', 'false', 'misleading', 'controversy']
const COUNTER_CREDIBILITY_THRESHOLD = 60 // 0-100 scale used by domainCredibility

function counterQuery(original: string): string {
  return `${original} ${COUNTER_TERMS.join(' OR ')}`
}

export interface AdversarialOutcome {
  /** Final verdict after the adversarial pass (may equal the input). */
  verdict: Verdict
  /** Evidence gathered specifically during the counter-search. */
  counterEvidence: Evidence[]
  /** Whether the adversarial pass actually downgraded the verdict. */
  downgraded: boolean
}

/**
 * Run the adversarial pass against a verdict. Returns a new verdict object
 * (never mutates input) with `counterEvidence` populated and `label`
 * potentially downgraded to `CONTESTED`.
 *
 * Safe to call on any verdict — short-circuits when label is not VERIFIED.
 */
export async function adversarialReview(
  verdict: Verdict,
  searchQuery: string,
  model: LLM,
): Promise<AdversarialOutcome> {
  if (verdict.label !== 'VERIFIED') {
    return { verdict, counterEvidence: [], downgraded: false }
  }

  const outcome = await searchTavilyWithStatus(counterQuery(searchQuery), 5)
  if (!outcome.configured || outcome.error || outcome.results.length === 0) {
    return { verdict, counterEvidence: [], downgraded: false }
  }

  const counterEvidence: Evidence[] = []
  for (const r of outcome.results) {
    if (!r.content) continue
    const compressed = await compressDocument(r.content, verdict.claimText, model)
    const nli = await classifyNli(verdict.claimText, compressed, r.url, model)
    counterEvidence.push({
      source: hostnameOf(r.url) ?? r.title,
      url: r.url,
      excerpt: compressed,
      stance: nli.stance,
      credibilityScore: nli.credibilityScore,
    })
  }

  // Counter-evidence threshold: at least one CONTRADICTS document with
  // credibility >= COUNTER_CREDIBILITY_THRESHOLD is enough to mark
  // CONTESTED. A single low-credibility blog dissent is intentionally
  // not enough.
  const hasStrongCounter = counterEvidence.some(
    (e) => e.stance === 'CONTRADICTS' && e.credibilityScore >= COUNTER_CREDIBILITY_THRESHOLD,
  )

  if (!hasStrongCounter) {
    return {
      verdict: { ...verdict, counterEvidence },
      counterEvidence,
      downgraded: false,
    }
  }

  return {
    verdict: {
      ...verdict,
      label: 'CONTESTED',
      counterEvidence,
      // Confidence is anchored to the strongest counter-source.
      confidencePct: Math.max(40, 100 - maxCounterCredibility(counterEvidence)),
    },
    counterEvidence,
    downgraded: true,
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function maxCounterCredibility(evidence: Evidence[]): number {
  let max = 0
  for (const e of evidence) {
    if (e.stance === 'CONTRADICTS' && e.credibilityScore > max) {
      max = e.credibilityScore
    }
  }
  return max
}
