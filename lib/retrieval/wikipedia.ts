import type { SearchResult } from '@/lib/types'
import { withRetry } from '@/lib/utils/retry'

interface WikiSummary {
  title?: string
  extract?: string
  content_urls?: { desktop?: { page?: string } }
  type?: string
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    return await withRetry(
      async () => {
        const res = await fetch(url, {
          headers: { accept: 'application/json', 'user-agent': 'veritas-fact-checker/1.0' },
        })
        if (!res.ok) {
          // 404 means the article doesn't exist — don't burn retries on that
          if (res.status === 404) return null as T | null
          throw new Error(`wikipedia ${res.status}`)
        }
        return (await res.json()) as T
      },
      { maxRetries: 2, label: 'wikipedia' },
    )
  } catch {
    return null
  }
}

async function fetchSummary(title: string): Promise<WikiSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  return fetchJson<WikiSummary>(url)
}

async function fetchSearchTop(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&origin=*&srsearch=${encodeURIComponent(
    query,
  )}`
  const data = await fetchJson<{ query?: { search?: { title: string }[] } }>(url)
  return data?.query?.search?.[0]?.title ?? null
}

export async function searchWikipedia(query: string): Promise<SearchResult | null> {
  const direct = await fetchSummary(query)
  if (direct?.extract && direct.type !== 'disambiguation') {
    return {
      title: direct.title ?? query,
      url: direct.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
      content: direct.extract,
      score: 0.9,
    }
  }
  const found = await fetchSearchTop(query)
  if (!found) return null
  const summary = await fetchSummary(found)
  if (!summary?.extract) return null
  return {
    title: summary.title ?? found,
    url: summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(found)}`,
    content: summary.extract,
    score: 0.8,
  }
}
