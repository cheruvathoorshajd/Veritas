import { tavily, type TavilyClient } from '@tavily/core'
import type { SearchResult } from '@/lib/types'
import { withRetry } from '@/lib/utils/retry'

let client: TavilyClient | null = null
function getClient(): TavilyClient | null {
  if (client) return client
  const key = process.env.TAVILY_API_KEY
  if (!key) return null
  client = tavily({ apiKey: key })
  return client
}

export async function searchTavily(query: string, maxResults = 5): Promise<SearchResult[]> {
  const c = getClient()
  if (!c) {
    console.warn('[tavily] TAVILY_API_KEY not set, skipping search')
    return []
  }
  try {
    const res = await withRetry(
      () =>
        c.search(query, {
          maxResults,
          searchDepth: 'basic',
          includeAnswer: false,
        }),
      { maxRetries: 2, label: 'tavily' },
    )
    const results = res?.results ?? []
    return results.map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      content: r.content ?? '',
      score: typeof r.score === 'number' ? r.score : 0,
    }))
  } catch (err) {
    console.warn('[tavily] search failed after retries:', (err as Error).message)
    return []
  }
}
