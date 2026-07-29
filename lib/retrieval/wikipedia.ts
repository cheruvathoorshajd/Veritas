import type { SearchResult } from '@/lib/types'
import { withRetry } from '@/lib/utils/retry'
import { logger } from '@/lib/utils/logger'

const log = logger('wikipedia')

interface WikiSummary {
  title?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
  type?: string
}

export interface WikiOutcome {
  result: SearchResult | null
  error?: string
}

async function fetchJsonOrThrow<T>(url: string): Promise<T | null> {
  return withRetry(
    async () => {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'veritas-fact-checker/1.0' },
      })
      if (!res.ok) {
        if (res.status === 404) return null as T | null
        throw new Error(`wikipedia ${res.status}`)
      }
      return (await res.json()) as T
    },
    { maxRetries: 2, label: 'wikipedia' },
  )
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  return fetchJsonOrThrow<WikiSummary>(url)
}

async function fetchSearchTop(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&origin=*&srsearch=${encodeURIComponent(
    query,
  )}`
  const data = await fetchJsonOrThrow<{ query?: { search?: { title: string }[] } }>(url)
  return data?.query?.search?.[0]?.title ?? null
}

export async function searchWikipediaWithStatus(query: string): Promise<WikiOutcome> {
  try {
    const direct = await fetchSummary(query)
    if (direct?.extract && direct.type !== 'disambiguation') {
      return {
        result: {
          title: direct.title ?? query,
          url:
            direct.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
          content: direct.extract,
          score: 0.9,
        },
      }
    }
    const found = await fetchSearchTop(query)
    if (!found) return { result: null }
    const summary = await fetchSummary(found)
    if (!summary?.extract) return { result: null }
    return {
      result: {
        title: summary.title ?? found,
        url:
          summary.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(found)}`,
        content: summary.extract,
        score: 0.8,
      },
    }
  } catch (err) {
    const message = (err as Error).message || 'unknown error'
    log.warn('lookup failed', { query, error: message })
    return { result: null, error: message }
  }
}
