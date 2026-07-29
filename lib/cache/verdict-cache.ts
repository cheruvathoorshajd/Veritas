/**
 * Phase 3C — LRU verdict cache.
 *
 * Same claim text against the same set of source URLs should not pay the
 * full pipeline cost twice within a run (or even across nearby runs on
 * the same instance). The cache keys on a stable hash of:
 *   - normalised claim text
 *   - sorted list of source URLs used during verification
 * The value is the synthesised Verdict.
 *
 * In-memory only — like rate-limit.ts, this is per-instance and falls
 * over on horizontal scale. Acceptable: cache misses are still correct.
 */

import type { Verdict } from '@/lib/types'

interface Entry {
  key: string
  value: Verdict
  addedAt: number
}

const MAX_ENTRIES = 100
const TTL_MS = 60 * 60 * 1000 // 1 hour

const store = new Map<string, Entry>()
let hits = 0
let misses = 0

function fnvHash(input: string): string {
  // 32-bit FNV-1a — fast, deterministic, good enough for cache keys.
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function verdictCacheKey(claimText: string, sourceUrls: string[]): string {
  const claimNorm = normalise(claimText)
  const urlList = [...sourceUrls].sort().join('|')
  return fnvHash(`${claimNorm}::${urlList}`)
}

export function getVerdict(key: string): Verdict | null {
  const entry = store.get(key)
  if (!entry) {
    misses += 1
    return null
  }
  if (Date.now() - entry.addedAt > TTL_MS) {
    store.delete(key)
    misses += 1
    return null
  }
  // refresh LRU position
  store.delete(key)
  store.set(key, entry)
  hits += 1
  return entry.value
}

export function setVerdict(key: string, value: Verdict): void {
  if (store.has(key)) store.delete(key)
  store.set(key, { key, value, addedAt: Date.now() })
  if (store.size > MAX_ENTRIES) {
    // delete the oldest (first inserted) entry
    const first = store.keys().next().value
    if (first !== undefined) store.delete(first)
  }
}

export function cacheStats(): { hits: number; misses: number; size: number } {
  return { hits, misses, size: store.size }
}

export function resetVerdictCacheForTests(): void {
  store.clear()
  hits = 0
  misses = 0
}
