import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deduplicateClaims } from '../../lib/agents/claim-extraction'
import type { ExtractedClaim } from '../../lib/types'

function claim(
  id: string,
  text: string,
  speaker = 'A',
  confidence = 0.5,
): ExtractedClaim {
  return {
    id,
    speaker,
    timestamp: '0:00',
    originalText: text,
    claimText: text,
    searchQuery: text,
    isCheckworthy: true,
    extractionConfidence: confidence,
  }
}

test('identical claims from same speaker → merged', () => {
  const claims = [
    claim('1', 'The unemployment rate is 3.7 percent'),
    claim('2', 'The unemployment rate is 3.7 percent'),
  ]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 1)
  assert.deepEqual(out[0].mergedFromIds, ['2'])
})

test('near-duplicate claims (token overlap > 0.85) merged', () => {
  // Jaccard threshold is 0.85, so the two texts must overlap on almost
  // every content token. A single inserted modifier ("approximately") is
  // enough to land at ~0.87.
  const claims = [
    claim('1', 'United States unemployment rate hit three point seven percent during March'),
    claim('2', 'United States unemployment rate hit approximately three point seven percent during March'),
  ]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 1)
})

test('same text from DIFFERENT speakers → not merged', () => {
  const claims = [
    claim('1', 'Inflation is 9 percent', 'A'),
    claim('2', 'Inflation is 9 percent', 'B'),
  ]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 2)
})

test('higher-confidence version is kept on merge', () => {
  const low = claim(
    '1',
    'inflation rate hit nine percent during last quarter',
    'A',
    0.3,
  )
  const high = claim(
    '2',
    'The inflation rate hit nine percent during the last quarter',
    'A',
    0.9,
  )
  const out = deduplicateClaims([low, high])
  assert.equal(out.length, 1)
  assert.equal(out[0].extractionConfidence, 0.9)
  assert.equal(
    out[0].claimText,
    'The inflation rate hit nine percent during the last quarter',
  )
})

test('distinct claims preserved', () => {
  const claims = [
    claim('1', 'The capital of France is Paris'),
    claim('2', 'Mount Everest is 8848 meters tall'),
    claim('3', 'Water boils at 100 degrees Celsius'),
  ]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 3)
})

test('single-claim input returned unchanged', () => {
  const claims = [claim('1', 'Only claim')]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 1)
  assert.equal(out[0].mergedFromIds, undefined)
})

test('empty input → empty output', () => {
  assert.deepEqual(deduplicateClaims([]), [])
})

test('three-way duplicate merges into one', () => {
  const claims = [
    claim('1', 'The earth is round and orbits the sun'),
    claim('2', 'Earth is round and orbits the sun'),
    claim('3', 'The earth orbits the sun and is round'),
  ]
  const out = deduplicateClaims(claims)
  assert.equal(out.length, 1)
  assert.equal(out[0].mergedFromIds?.length, 2)
})
