import { traceable } from 'langsmith/traceable'
import type { LLM } from '@/lib/agents/llm'
import type { Evidence, ExtractedClaim, Verdict, VerdictLabel } from '@/lib/types'
import { extractJsonObject } from '@/lib/utils/json'
import { uuid } from '@/lib/utils/id'

const SYSTEM_PROMPT = `You are a fact-checking verdict analyst. Given a claim and supporting evidence, produce a structured verdict.

Rules:
- VERIFIED: 2+ credible sources consistently support the claim
- FALSE: 1+ credible source directly contradicts the specific claim with data
- MISLEADING: claim is technically true but omits critical context, cherry-picks data, or creates a false impression
- UNVERIFIED: insufficient evidence to confirm or deny

Confidence scoring (0-100):
- 90-100: overwhelming consistent evidence
- 70-89: strong evidence, minor ambiguity
- 40-69: mixed or incomplete evidence (flag for human review)
- 0-39: contradictory evidence

Return JSON exactly:
{
  "label": "VERIFIED|FALSE|MISLEADING|UNVERIFIED",
  "confidencePct": <number>,
  "explanation": "<one clear paragraph explaining the verdict, citing specific sources>"
}
No markdown. No preamble.`

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        typeof p === 'string'
          ? p
          : p && typeof p === 'object' && 'text' in p
            ? (p as { text?: string }).text ?? ''
            : '',
      )
      .join('\n')
  }
  return ''
}

/**
 * Credibility-weighted heuristic verdict. Mirrors `isSufficient` in
 * `lib/agents/verification.ts` so the same rubric drives both early-stopping
 * and final adjudication. FALSE / VERIFIED branches now compare aggregate
 * credibility (sum per stance) instead of source counts, and confidence is
 * derived from the weighted margin (clamped 0-95). MISLEADING stays as
 * "both sides have at least one credibility >= 60" source.
 */
function heuristicVerdict(claim: ExtractedClaim, evidence: Evidence[]): {
  label: VerdictLabel
  confidencePct: number
  explanation: string
} {
  if (!evidence.length) {
    return {
      label: 'UNVERIFIED',
      confidencePct: 20,
      explanation:
        'No evidence was retrieved from web sources, so the claim cannot be confirmed or denied.',
    }
  }
  const supports = evidence.filter((e) => e.stance === 'SUPPORTS')
  const contradicts = evidence.filter((e) => e.stance === 'CONTRADICTS')
  const supportScore = supports.reduce((s, e) => s + e.credibilityScore, 0)
  const contradictScore = contradicts.reduce((s, e) => s + e.credibilityScore, 0)
  const margin = Math.abs(supportScore - contradictScore)
  const marginConfidence = Math.max(0, Math.min(95, Math.round(margin)))

  const credibleSupport = supports.find((e) => e.credibilityScore >= 60)
  const credibleContradict = contradicts.find((e) => e.credibilityScore >= 60)
  if (credibleSupport && credibleContradict) {
    // Genuinely balanced cases sit at 55; the further one side outweighs the
    // other (in credibility-weighted score), the more confidence drifts away
    // from the centre. Clamped to [40, 70] so the verdict always lands in
    // the human-review approval band — not a confident verified/false.
    const conf = Math.max(
      40,
      Math.min(70, 55 - Math.min(margin / 4, 10)),
    )
    return {
      label: 'MISLEADING',
      confidencePct: Math.round(conf),
      explanation: `Mixed evidence: ${credibleSupport.source} supports parts of the claim while ${credibleContradict.source} contradicts it.`,
    }
  }

  if (contradictScore > supportScore && (contradictScore >= 120 || (contradicts[0]?.credibilityScore ?? 0) >= 90)) {
    return {
      label: 'FALSE',
      confidencePct: marginConfidence,
      explanation: `Contradicted by ${contradicts[0].source}: ${contradicts[0].excerpt.slice(0, 300)}`,
    }
  }
  if (supportScore > contradictScore && (supportScore >= 120 || (supports[0]?.credibilityScore ?? 0) >= 90)) {
    const firstTwo = supports.slice(0, 2).map((s) => s.source)
    return {
      label: 'VERIFIED',
      confidencePct: marginConfidence,
      explanation:
        supports.length >= 2
          ? `Supported by multiple sources including ${firstTwo.join(' and ')}.`
          : `Supported by ${firstTwo[0]} (primary source).`,
    }
  }
  return {
    label: 'UNVERIFIED',
    confidencePct: 35,
    explanation:
      'Evidence was retrieved but was not conclusive enough to issue a confident verdict.',
  }
}

async function synthesiseVerdictImpl(
  claim: ExtractedClaim,
  evidence: Evidence[],
  model: LLM,
  searchQueries: string[],
  iterationsUsed: number,
): Promise<Verdict> {
  let label: VerdictLabel = 'UNVERIFIED'
  let confidencePct = 30
  let explanation = ''

  // If we retrieved nothing, the LLM call is guaranteed to produce an
  // uncertain JSON parse anyway — short-circuit straight to the heuristic
  // empty-evidence branch and save a round-trip.
  if (evidence.length === 0) {
    const h = heuristicVerdict(claim, evidence)
    label = h.label
    confidencePct = h.confidencePct
    explanation = h.explanation
  } else {
    const evidenceBlock = evidence
      .map(
        (e, i) =>
          `[${i + 1}] source=${e.source} url=${e.url} stance=${e.stance} credibility=${e.credibilityScore}\n${e.excerpt.slice(0, 800)}`,
      )
      .join('\n\n')
    const prompt = `${SYSTEM_PROMPT}\n\nCLAIM: ${claim.claimText}\n\nEVIDENCE:\n${evidenceBlock}`

    try {
      const response = await model.invoke(prompt)
      const obj = extractJsonObject<{
        label?: unknown
        confidencePct?: unknown
        explanation?: unknown
      }>(messageText(response.content))
      if (!obj) throw new Error('verdict JSON could not be parsed')
      if (obj.label === 'VERIFIED' || obj.label === 'FALSE' || obj.label === 'MISLEADING' || obj.label === 'UNVERIFIED') {
        label = obj.label
      }
      if (typeof obj.confidencePct === 'number') {
        confidencePct = Math.max(0, Math.min(100, Math.round(obj.confidencePct)))
      }
      if (typeof obj.explanation === 'string') explanation = obj.explanation.trim()
    } catch (err) {
      console.warn('[verdict] LLM synth failed, falling back to heuristic:', (err as Error).message)
      const h = heuristicVerdict(claim, evidence)
      label = h.label
      confidencePct = h.confidencePct
      explanation = h.explanation
    }

    if (!explanation) explanation = heuristicVerdict(claim, evidence).explanation
  }

  const approvalRequired = confidencePct >= 40 && confidencePct <= 70

  return {
    id: uuid(),
    claimId: claim.id,
    speaker: claim.speaker,
    timestamp: claim.timestamp,
    claimText: claim.claimText,
    label,
    confidencePct,
    explanation,
    evidence,
    searchQueries,
    iterationsUsed,
    approvalRequired,
    approved: null,
  }
}

export const synthesiseVerdict = traceable(synthesiseVerdictImpl, {
  name: 'veritas:verdict-synthesis',
  project_name: 'veritas',
})
