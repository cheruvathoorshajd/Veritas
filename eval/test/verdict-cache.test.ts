import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  verdictCacheKey,
  getVerdict,
  setVerdict,
  cacheStats,
  resetVerdictCacheForTests,
} from '../../lib/cache/verdict-cache'
import type { Verdict } from '../../lib/types'

beforeEach(() => {
  resetVerdictCacheForTests()
})

function mockVerdict(id = 'v1'): Verdict {
  return {
    id,
    claimId: 'c1',
    speaker: 'A',
    timestamp: '0:00',
    claimText: 'test claim',
    label: 'VERIFIED',
    confidencePct: 90,
    explanation: '',
    evidence: [],
    searchQueries: [],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  }
}

test('verdictCacheKey is deterministic for same inputs', () => {
  const k1 = verdictCacheKey('the sky is blue', ['https://a.com', 'https://b.com'])
  const k2 = verdictCacheKey('the sky is blue', ['https://a.com', 'https://b.com'])
  assert.equal(k1, k2)
})

test('verdictCacheKey is order-independent on URLs', () => {
  const k1 = verdictCacheKey('claim', ['https://a.com', 'https://b.com'])
  const k2 = verdictCacheKey('claim', ['https://b.com', 'https://a.com'])
  assert.equal(k1, k2)
})

test('verdictCacheKey normalises claim whitespace and case', () => {
  const k1 = verdictCacheKey('The Sky is Blue', [])
  const k2 = verdictCacheKey('  the   sky   is   blue  ', [])
  assert.equal(k1, k2)
})

test('cache miss returns null and increments misses', () => {
  const key = verdictCacheKey('claim', ['url'])
  const v = getVerdict(key)
  assert.equal(v, null)
  assert.equal(cacheStats().misses, 1)
})

test('set then get returns the stored verdict and increments hits', () => {
  const key = verdictCacheKey('claim', ['url'])
  const v = mockVerdict()
  setVerdict(key, v)
  const got = getVerdict(key)
  assert.deepEqual(got, v)
  assert.equal(cacheStats().hits, 1)
})

test('cache evicts oldest when over 100 entries', () => {
  for (let i = 0; i < 105; i++) {
    setVerdict(verdictCacheKey(`claim-${i}`, []), mockVerdict(`v${i}`))
  }
  assert.equal(cacheStats().size, 100)
})

test('LRU: accessing an entry moves it to most-recent', () => {
  setVerdict('a', mockVerdict('a'))
  setVerdict('b', mockVerdict('b'))
  setVerdict('c', mockVerdict('c'))
  // Touch 'a' so it becomes most recent.
  getVerdict('a')
  // Fill up to 100; the next insert evicts 'b' (now the oldest), not 'a'.
  for (let i = 0; i < 97; i++) setVerdict(`fill-${i}`, mockVerdict(`fill-${i}`))
  setVerdict('overflow', mockVerdict('overflow'))
  assert.notEqual(getVerdict('a'), null)
  assert.equal(getVerdict('b'), null)
})

test('resetVerdictCacheForTests clears state', () => {
  setVerdict('a', mockVerdict('a'))
  resetVerdictCacheForTests()
  assert.equal(cacheStats().size, 0)
  assert.equal(cacheStats().hits, 0)
  assert.equal(cacheStats().misses, 0)
})
