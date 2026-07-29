import { traceable } from 'langsmith/traceable'
import type { LLM } from '@/lib/agents/llm'
import type { Evidence, ExtractedClaim, RetrievalSource } from '@/lib/types'
import { searchTavilyWithStatus } from '@/lib/retrieval/tavily'
import { searchWikipediaWithStatus } from '@/lib/retrieval/wikipedia'
import { searchPolitifact, getLastPolitifactError } from '@/lib/retrieval/politifact'
import { compressDocument } from '@/lib/retrieval/compress'
import { classifyNli } from '@/lib/nlp/nli'
import { reformulateQuery } from '@/lib/nlp/query-reformulator'

export interface VerificationProgress {
  onIteration?: (query: string, iteration: number) => void
  onRetrievalIssue?: (source: RetrievalSource, message: string) => void
}

interface GatheredResult {
  title: string
  url: string
  source: string
  content: string
  score: number
}

function tagSource(url: string, fallback: string): string {
  if (!url) return fallback
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host
  } catch {
    return fallback
  }
}

async function gatherParallel(
  query: string,
  onIssue?: (source: RetrievalSource, message: string) => void,
): Promise<GatheredResult[]> {
  const [tav, wiki, poli] = await Promise.all([
    searchTavilyWithStatus(query, 5).catch((err) => ({
      results: [],
      configured: true,
      error: (err as Error).message,
    })),
    searchWikipediaWithStatus(query).catch((err) => ({
      result: null,
      error: (err as Error).message,
    })),
    searchPolitifact(query).catch((err) => {
      onIssue?.('politifact', (err as Error).message)
      return []
    }),
  ])

  if (tav.error) onIssue?.('tavily', tav.error)
  if (wiki.error) onIssue?.('wikipedia', wiki.error)
  // PolitiFact only mutates a module-level error sentinel; surface the most
  // recent one if it changed during this call.
  const politifactErr = getLastPolitifactError()
  if (politifactErr) onIssue?.('politifact', politifactErr)

  const out: GatheredResult[] = []
  for (const r of tav.results) {
    if (!r.content) continue
    out.push({
      title: r.title,
      url: r.url,
      source: tagSource(r.url, 'Web'),
      content: r.content,
      score: r.score,
    })
  }
  if (wiki.result) {
    out.push({
      title: wiki.result.title,
      url: wiki.result.url,
      source: 'Wikipedia',
      content: wiki.result.content,
      score: wiki.result.score,
    })
  }
  for (const r of poli) {
    out.push({
      title: r.title,
      url: r.url,
      source: 'PolitiFact',
      content: r.content,
      score: r.score,
    })
  }
  return out.slice(0, 7)
}

/**
 * Credibility-weighted sufficiency.
 *
 * The NLI rubric in `lib/nlp/nli.ts` scores government / academic primary
 * sources at >=90, reputable news / fact-checking at 70-89, general news at
 * 50-69, low-quality at <50. We sum credibility on each side and stop when:
 *  - the dominant side reaches a meaningful aggregate (>= 120, roughly two
 *    mid-tier news sources or one primary), AND outweighs the other side by
 *    >= 40 (one mid-tier news source of clear margin), OR
 *  - any single source on either side has credibility >= 90 (primary
 *    government / academic source — definitive on its own).
 */
function isSufficient(evidence: Evidence[]): boolean {
  let supportScore = 0
  let contradictScore = 0
  let maxSingleSupport = 0
  let maxSingleContradict = 0
  for (const e of evidence) {
    if (e.stance === 'SUPPORTS') {
      supportScore += e.credibilityScore
      if (e.credibilityScore > maxSingleSupport) maxSingleSupport = e.credibilityScore
    } else if (e.stance === 'CONTRADICTS') {
      contradictScore += e.credibilityScore
      if (e.credibilityScore > maxSingleContradict) maxSingleContradict = e.credibilityScore
    }
  }
  if (maxSingleSupport >= 90 || maxSingleContradict >= 90) return true
  const dominant = Math.max(supportScore, contradictScore)
  const margin = Math.abs(supportScore - contradictScore)
  return dominant >= 120 && margin >= 40
}

// Hard cap on NLI / compression calls per claim. Once we have scored this many
// unique documents we stop scoring more even if subsequent iterations gather
// extra hits — the ReAct loop can still iterate for sufficiency re-checks but
// it cannot pull additional documents through NLI.
const MAX_DOCS_PER_CLAIM = 6

async function runReActVerificationImpl(
  claim: ExtractedClaim,
  model: LLM,
  maxIterations = 3,
  progress?: VerificationProgress,
): Promise<{ evidence: Evidence[]; queries: string[]; iterations: number }> {
  const evidence: Evidence[] = []
  const queries: string[] = []
  let query = claim.searchQuery || claim.claimText
  let iteration = 0

  while (iteration < maxIterations) {
    if (iteration > 0) {
      query = await reformulateQuery(claim.claimText, evidence, model)
    }
    queries.push(query)
    progress?.onIteration?.(query, iteration + 1)

    const gathered = await gatherParallel(query, progress?.onRetrievalIssue)
    // Two-level early termination: the inner break stops scoring further
    // docs from this iteration once sufficiency is met, the outer break
    // (after iteration++) skips the next ReAct iteration entirely. Either
    // alone is insufficient — the inner saves compress+NLI on docs 2..n of
    // the current iteration; the outer saves the next gather+reformulate.
    for (const g of gathered) {
      if (evidence.length >= MAX_DOCS_PER_CLAIM) break
      const already = evidence.find((e) => e.url === g.url)
      if (already) continue
      const compressed = await compressDocument(g.content, claim.claimText, model)
      const nli = await classifyNli(claim.claimText, compressed, g.url, model)
      evidence.push({
        source: g.source,
        url: g.url,
        excerpt: compressed,
        stance: nli.stance,
        credibilityScore: nli.credibilityScore,
      })
      if (isSufficient(evidence)) break
    }

    iteration += 1
    if (isSufficient(evidence)) break
  }

  return { evidence, queries, iterations: iteration }
}

// Expected behaviour after the inner-loop sufficiency check:
//  - A single .gov source returned in iteration 1 with credibility 95 and
//    stance SUPPORTS will trip `isSufficient` (maxSingleSupport >= 90)
//    immediately after the first push. The inner loop breaks, so docs 2..n
//    of iteration 1 are never compressed or NLI-classified. The outer
//    sufficiency check then short-circuits and iteration 2 never runs.
//  - `MAX_DOCS_PER_CLAIM` (6) still caps the worst case where no source is
//    individually decisive — the new check is an additional early
//    termination, not a replacement.

export const runReActVerification = traceable(runReActVerificationImpl, {
  name: 'veritas:react-verification',
  project_name: 'veritas',
})
