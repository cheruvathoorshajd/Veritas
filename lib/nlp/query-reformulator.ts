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
  const summaries = previousEvidence
    .slice(0, 4)
    .map((e, i) => `${i + 1}. [${e.stance}] ${e.source}: ${e.excerpt.slice(0, 300)}`)
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
