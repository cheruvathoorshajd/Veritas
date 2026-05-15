import type { LLM } from '@/lib/agents/llm'

function fallbackCompress(content: string, claim: string): string {
  const claimTokens = claim
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 3)
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean)
  const scored = sentences.map((s) => {
    const lc = s.toLowerCase()
    let score = 0
    for (const t of claimTokens) if (lc.includes(t)) score += 1
    return { s, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 6).map((x) => x.s).join(' ')
  const capped = top.length > 2000 ? top.slice(0, 2000) : top
  return capped || content.slice(0, 1200)
}

export async function compressDocument(
  content: string,
  claim: string,
  model: LLM,
): Promise<string> {
  const trimmed = content.trim()
  if (!trimmed) return ''
  // Latency, not Gemini cost, is the constraint on the free tier — widening
  // this short-circuit to 500 words skips the compression LLM call on most
  // Tavily snippets and Wikipedia summaries, which already arrive short.
  if (trimmed.split(/\s+/).length < 500) {
    return trimmed
  }
  const prompt = `Summarise the following document in 200-300 words, keeping only information relevant to verifying this claim: ${claim}\n\nDocument:\n${trimmed.slice(0, 8000)}`
  try {
    const response = await model.invoke(prompt)
    const text =
      typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content
              .map((part) =>
                typeof part === 'string'
                  ? part
                  : 'text' in part && typeof (part as { text?: string }).text === 'string'
                    ? (part as { text: string }).text
                    : '',
              )
              .join('\n')
          : ''
    return (text || fallbackCompress(trimmed, claim)).trim()
  } catch (err) {
    console.warn('[compress] LLM compress failed, falling back:', (err as Error).message)
    return fallbackCompress(trimmed, claim)
  }
}
