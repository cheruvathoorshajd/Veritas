import Parser from 'rss-parser'
import type { SearchResult } from '@/lib/types'
import { logger } from '@/lib/utils/logger'

const log = logger('politifact')
const FEED_URL = 'https://www.politifact.com/rss/factchecks/'
const CACHE_TTL_MS = 15 * 60 * 1000

interface CachedFeed {
  at: number
  items: RawItem[]
}

interface RawItem {
  title: string
  link: string
  contentSnippet: string
  isoDate?: string
}

const cache = new Map<string, CachedFeed>()
const parser = new Parser({
  timeout: 8000,
  headers: { 'user-agent': 'veritas-fact-checker/1.0' },
})

let lastFeedError: string | null = null

export function getLastPolitifactError(): string | null {
  return lastFeedError
}

async function getFeed(): Promise<RawItem[]> {
  const cached = cache.get(FEED_URL)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.items
  }
  try {
    const feed = await parser.parseURL(FEED_URL)
    const items: RawItem[] = (feed.items ?? []).map((i) => ({
      title: i.title ?? '',
      link: i.link ?? '',
      contentSnippet: (i.contentSnippet ?? i.content ?? '').trim(),
      isoDate: i.isoDate,
    }))
    cache.set(FEED_URL, { at: Date.now(), items })
    lastFeedError = null
    return items
  } catch (err) {
    const message = (err as Error).message || 'feed fetch failed'
    lastFeedError = message
    log.warn('feed fetch failed', { error: message })
    if (cached) return cached.items
    return []
  }
}

const STOP = new Set([
  'the', 'a', 'an', 'of', 'in', 'at', 'on', 'to', 'and', 'or', 'is', 'are', 'was',
  'were', 'be', 'been', 'for', 'by', 'with', 'that', 'this', 'these', 'those',
  'it', 'its', 'as', 'from',
])

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && t.length > 2 && !STOP.has(t))
}

export async function searchPolitifact(query: string): Promise<SearchResult[]> {
  const items = await getFeed()
  if (!items.length) return []
  const tokens = tokenize(query)
  if (!tokens.length) return []
  const scored = items
    .map((item) => {
      const hay = `${item.title} ${item.contentSnippet}`.toLowerCase()
      let hits = 0
      for (const t of tokens) if (hay.includes(t)) hits += 1
      return { item, hits }
    })
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)

  return scored.map(({ item, hits }) => ({
    title: item.title,
    url: item.link,
    content: item.contentSnippet || item.title,
    score: hits / tokens.length,
  }))
}
