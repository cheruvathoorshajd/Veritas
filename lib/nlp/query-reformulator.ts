import type { LLM } from '@/lib/agents/llm'
import type { Evidence } from '@/lib/types'

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p && typeof p === 'object' && 'text' in p ? (p as { text?: string }).text ?? '' : ''))
      .join('\n')
  }
  return ''
}

export async function reformulateQuery(
  claimText: string,
  previousEvidence: Evidence[],
  model: LLM,
): Promise<string> {
  if (!previousEvidence.length) return claimText
  // Score = |stance_sign| * credibilityScore. SUPPORTS/CONTRADICTS evidence
  // counts at full credibility weight; NEUTRAL items score 0 so they only
  // appear in the prompt when there's nothing else to show. Sort descending
  // by score, then keep insertion order for ties so the reformulation prompt
  // stays deterministic across retries. The earlier slice(0, 4) was anchored
  // to first-seen evidence — after a few iterations the model kept seeing
  // the same opening hits and produced near-identical query rewrites.
  const stanceSign = (s: Evidence['stance']) =>
    s === 'SUPPORTS' ? 1 : s === 'CONTRADICTS' ? -1 : 0
  const ranked = previousEvidence
    .map((e, i) => ({ e, i, score: Math.abs(stanceSign(e.stance)) * e.credibilityScore }))
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .slice(0, 4)
  const summaries = ranked
    .map(({ e }, i) => `${i + 1}. [${e.stance}] ${e.source}: ${e.excerpt.slice(0, 300)}`)
    .join('\n')
  const prompt = `You refine web search queries for fact-checking.

The claim: "${claimText}"

Previous evidence gathered (but insufficient):
${summaries}

Write a single new web search query (3-8 words) that would surface the missing evidence. Return only the query text, no quotes, no preamble.`
  try {
    const response = await model.invoke(prompt)
    const text = messageText(response.content).trim().split('\n')[0]
    const cleaned = text.replace(/^["'`]|["'`]$/g, '').trim()
    return cleaned || claimText
  } catch {
    return claimText
  }
}
