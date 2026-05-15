/**
 * Static credibility priors for well-known domains. Returning a fixed score
 * for these hosts removes one full LLM judgement per evidence item — the
 * NLI step still has to classify stance, but credibility is anchored to a
 * tier that no LLM heuristic should override.
 *
 *   domainCredibility('https://www.bls.gov/news.release/...') === 95
 *   domainCredibility('https://reuters.com/world/...')        === 85
 *   domainCredibility('https://example.blogspot.com/post')    === null
 */

const PRIMARY_HOSTS = new Set([
  'bls.gov',
  'federalreserve.gov',
  'ipcc.ch',
  'nasa.gov',
  'who.int',
  'cdc.gov',
  'nih.gov',
  'un.org',
])

const PRIMARY_SUFFIXES = ['.gov', '.edu']

const NEWS_HOSTS = new Set([
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'npr.org',
  'politifact.com',
  'factcheck.org',
  'snopes.com',
  'washingtonpost.com',
  'nytimes.com',
  'ft.com',
  'economist.com',
  'bloomberg.com',
  'wsj.com',
])

const WIKIPEDIA_HOST = 'en.wikipedia.org'

export function domainCredibility(url: string): number | null {
  if (!url) return null
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
  if (PRIMARY_HOSTS.has(host)) return 95
  for (const suffix of PRIMARY_SUFFIXES) {
    if (host.endsWith(suffix)) return 95
  }
  if (NEWS_HOSTS.has(host)) return 85
  if (host === WIKIPEDIA_HOST) return 75
  return null
}
