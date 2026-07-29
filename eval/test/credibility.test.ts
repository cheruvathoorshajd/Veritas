import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeCredibility,
  computeCredibilityBySpeaker,
} from '../../lib/credibility/score'

test('10 verified, 0 false → score = 1.0, green', () => {
  const verdicts = Array(10).fill({ label: 'VERIFIED' as const })
  const c = computeCredibility(verdicts)
  assert.equal(c.score, 1)
  assert.equal(c.tier, 'green')
  assert.equal(c.verified, 10)
})

test('5 verified, 5 false → score = 0.5, amber', () => {
  const verdicts = [
    ...Array(5).fill({ label: 'VERIFIED' as const }),
    ...Array(5).fill({ label: 'FALSE' as const }),
  ]
  const c = computeCredibility(verdicts)
  assert.equal(c.score, 0.5)
  assert.equal(c.tier, 'amber')
})

test('0 verified, 0 false → score null, no badge', () => {
  const c = computeCredibility([])
  assert.equal(c.score, null)
  assert.equal(c.tier, null)
})

test('only UNVERIFIED claims → score null (no signal either way)', () => {
  const verdicts = [
    { label: 'UNVERIFIED' as const },
    { label: 'UNVERIFIED' as const },
  ]
  const c = computeCredibility(verdicts)
  assert.equal(c.score, null)
  assert.equal(c.tier, null)
  assert.equal(c.unverified, 2)
})

test('boundary: score exactly 0.8 → green', () => {
  const verdicts = [
    { label: 'VERIFIED' as const },
    { label: 'VERIFIED' as const },
    { label: 'VERIFIED' as const },
    { label: 'VERIFIED' as const },
    // 4 verified, 1 misleading → (4 + 0.3) / 5 = 0.86 → green
    { label: 'MISLEADING' as const },
  ]
  const c = computeCredibility(verdicts)
  assert.ok(c.score! >= 0.8)
  assert.equal(c.tier, 'green')
})

test('boundary: score 0.79 → amber', () => {
  // 5 verified, 5 misleading → (5 + 1.5) / 10 = 0.65 → amber
  const verdicts = [
    ...Array(5).fill({ label: 'VERIFIED' as const }),
    ...Array(5).fill({ label: 'MISLEADING' as const }),
  ]
  const c = computeCredibility(verdicts)
  assert.equal(c.tier, 'amber')
})

test('boundary: score below 0.5 → red', () => {
  const verdicts = [
    { label: 'VERIFIED' as const },
    ...Array(9).fill({ label: 'FALSE' as const }),
  ]
  const c = computeCredibility(verdicts)
  assert.ok(c.score! < 0.5)
  assert.equal(c.tier, 'red')
})

test('CONTESTED contributes 0.3', () => {
  // 1 VERIFIED, 1 CONTESTED → (1 + 0.3) / 2 = 0.65 → amber
  const c = computeCredibility([
    { label: 'VERIFIED' as const },
    { label: 'CONTESTED' as const },
  ])
  assert.equal(c.score, 0.65)
  assert.equal(c.tier, 'amber')
  assert.equal(c.contested, 1)
})

test('computeCredibilityBySpeaker groups correctly', () => {
  const verdicts = [
    { speaker: 'A', label: 'VERIFIED' as const },
    { speaker: 'A', label: 'VERIFIED' as const },
    { speaker: 'B', label: 'FALSE' as const },
  ]
  const grouped = computeCredibilityBySpeaker(verdicts)
  assert.equal(grouped.get('A')?.score, 1)
  assert.equal(grouped.get('A')?.tier, 'green')
  assert.equal(grouped.get('B')?.score, 0)
  assert.equal(grouped.get('B')?.tier, 'red')
})
