import { tavily, type TavilyClient } from '@tavily/core'
import type { SearchResult } from '@/lib/types'
import { withRetry } from '@/lib/utils/retry'
import { logger } from '@/lib/utils/logger'

const log = logger('tavily')

let client: TavilyClient | null = null
function getClient(): TavilyClient | null {
  if (client) return client
  const key = process.env.TAVILY_API_KEY
  if (!key) return null
  client = tavily({ apiKey: key })
  return client
}

export interface SearchOutcome {
  results: SearchResult[]
  error?: string
  configured: boolean
}

export async function searchTavilyWithStatus(
  query: string,
  maxResults = 5,
): Promise<SearchOutcome> {
  const c = getClient()
  if (!c) {
    return { results: [], configured: false, error: 'TAVILY_API_KEY not set' }
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
    return {
      configured: true,
      results: results.map((r) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
        score: typeof r.score === 'number' ? r.score : 0,
      })),
    }
  } catch (err) {
    const message = (err as Error).message || 'unknown error'
    log.warn('search failed after retries', { query, error: message })
    return { results: [], configured: true, error: message }
  }
}

export async function searchTavily(query: string, maxResults = 5): Promise<SearchResult[]> {
  const { results } = await searchTavilyWithStatus(query, maxResults)
  return results
}
