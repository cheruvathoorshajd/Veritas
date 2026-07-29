/**
 * Phase 4A — Claim Genealogy Graph.
 *
 * Builds a DAG over claims by connecting:
 *   1. claims that share named entities, OR
 *   2. claims whose verbatim text has token overlap > THRESHOLD.
 *
 * Edge weight is the similarity score. The rendering layer can colour
 * nodes by verdict, weight edges by similarity, and traverse ancestry on
 * click — the data structure here is shape-only, no rendering logic.
 *
 * Cycle safety: the underlying claim list is flat (no parent pointers),
 * so the natural representation is an undirected weighted graph. We
 * emit it as a directed graph with edges (i → j) where i < j by id —
 * this guarantees acyclicity for any consumer that respects edge
 * direction, and the renderer is free to ignore direction.
 */

import type {
  ExtractedClaim,
  GenealogyEdge,
  GenealogyGraph,
  GenealogyNode,
  Verdict,
} from '@/lib/types'

const TOKEN_OVERLAP_THRESHOLD = 0.6
const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'and', 'or', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'to', 'for', 'by', 'with', 'as', 'that',
  'this', 'it', 'its', 'from', 'has', 'have', 'had', 'will', 'would',
  'should', 'can', 'could', 'may', 'might', 'do', 'does', 'did',
])

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_TOKENS.has(t)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const t of a) if (b.has(t)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function entityOverlap(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((e) => e.toLowerCase()))
  const out: string[] = []
  for (const e of a) {
    if (setB.has(e.toLowerCase())) out.push(e)
  }
  return out
}

/**
 * Build the genealogy graph from a list of claims (and an aligned list of
 * verdicts so node colour comes from the actual verdict). The function
 * tolerates a missing verdict for any claim — that node is emitted as
 * UNVERIFIED.
 */
export function buildGenealogy(
  claims: ExtractedClaim[],
  verdicts: Verdict[],
): GenealogyGraph {
  const verdictByClaim = new Map<string, Verdict>()
  for (const v of verdicts) verdictByClaim.set(v.claimId, v)

  const nodes: GenealogyNode[] = claims.map((c) => ({
    id: c.id,
    label: c.claimText,
    verdict: verdictByClaim.get(c.id)?.label ?? 'UNVERIFIED',
    speaker: c.speaker,
    entities: c.entities ?? [],
  }))

  const edges: GenealogyEdge[] = []
  const tokensCache = new Map<string, Set<string>>()
  for (const c of claims) tokensCache.set(c.id, tokenize(c.claimText))

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i]
      const b = claims[j]
      const shared = entityOverlap(a.entities ?? [], b.entities ?? [])
      const tokensA = tokensCache.get(a.id)!
      const tokensB = tokensCache.get(b.id)!
      const overlap = jaccard(tokensA, tokensB)
      const weight = Math.max(
        shared.length > 0 ? Math.min(1, 0.5 + 0.1 * shared.length) : 0,
        overlap,
      )
      if (shared.length > 0 || overlap > TOKEN_OVERLAP_THRESHOLD) {
        edges.push({ from: a.id, to: b.id, weight, sharedEntities: shared })
      }
    }
  }

  return { nodes, edges }
}

/**
 * Identify claims that should display a "⚠ Credibility Warning" because
 * the same speaker has at least one FALSE claim referencing one of this
 * claim's entities. Returns the set of claim ids to flag.
 *
 * Used by the UI to dim/badge specific claim cards beyond their own
 * verdict — this is the propagation rule from the sprint spec.
 */
export function propagateFalseWarnings(
  claims: ExtractedClaim[],
  verdicts: Verdict[],
): Set<string> {
  const falseEntitiesBySpeaker = new Map<string, Set<string>>()
  for (const v of verdicts) {
    if (v.label !== 'FALSE') continue
    const claim = claims.find((c) => c.id === v.claimId)
    if (!claim || !claim.entities) continue
    const existing = falseEntitiesBySpeaker.get(v.speaker) ?? new Set<string>()
    for (const e of claim.entities) existing.add(e.toLowerCase())
    falseEntitiesBySpeaker.set(v.speaker, existing)
  }

  const warned = new Set<string>()
  for (const c of claims) {
    const taintedEntities = falseEntitiesBySpeaker.get(c.speaker)
    if (!taintedEntities) continue
    const entities = c.entities ?? []
    if (entities.some((e) => taintedEntities.has(e.toLowerCase()))) {
      warned.add(c.id)
    }
  }
  return warned
}
