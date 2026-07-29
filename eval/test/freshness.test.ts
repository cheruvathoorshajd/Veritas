import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeFreshness,
  summariseFreshness,
  HALF_LIFE_DAYS,
} from '../../lib/decay/freshness'

const day = 86_400_000
function dateOffset(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * day)
}

test('statistical claim after 1 day → fresh', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 1 * day).toISOString(),
    claimType: 'statistical' as const,
  }
  const f = computeFreshness(verdict, null, now)
  assert.ok(f.freshness > 0.9, `expected >0.9, got ${f.freshness}`)
  assert.equal(f.isStale, false)
  assert.equal(f.halfLifeDays, 30)
})

test('statistical claim after 31 days → stale', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 31 * day).toISOString(),
    claimType: 'statistical' as const,
  }
  const f = computeFreshness(verdict, null, now)
  assert.ok(f.freshness < 0.5)
  assert.equal(f.isStale, true)
})

test('historical claim never decays', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 365 * day).toISOString(),
    claimType: 'historical' as const,
  }
  const f = computeFreshness(verdict, null, now)
  assert.equal(f.freshness, 1)
  assert.equal(f.isStale, false)
  assert.equal(f.halfLifeDays, null)
})

test('normative claim never decays', () => {
  const verdict = {
    producedAt: dateOffset(1000).toISOString(),
    claimType: 'normative' as const,
  }
  const f = computeFreshness(verdict)
  assert.equal(f.freshness, 1)
  assert.equal(f.isStale, false)
})

test('predictive claim past predicted date → freshness 0', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 10 * day).toISOString(),
    claimType: 'predictive' as const,
  }
  const predictedDate = new Date(now.getTime() - 1 * day) // 1 day ago — passed
  const f = computeFreshness(verdict, predictedDate, now)
  assert.equal(f.freshness, 0)
  assert.equal(f.isStale, true)
})

test('predictive claim before predicted date → freshness 1', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 10 * day).toISOString(),
    claimType: 'predictive' as const,
  }
  const predictedDate = new Date(now.getTime() + 30 * day) // 30 days in future
  const f = computeFreshness(verdict, predictedDate, now)
  assert.equal(f.freshness, 1)
  assert.equal(f.isStale, false)
})

test('political_position decays fast (8 days → stale)', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 8 * day).toISOString(),
    claimType: 'political_position' as const,
  }
  const f = computeFreshness(verdict, null, now)
  assert.ok(f.freshness < 0.5)
  assert.equal(f.isStale, true)
})

test('scientific_consensus decays slowly (180 days still fresh)', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 180 * day).toISOString(),
    claimType: 'scientific_consensus' as const,
  }
  const f = computeFreshness(verdict, null, now)
  assert.ok(f.freshness > 0.5)
  assert.equal(f.isStale, false)
})

test('missing claimType defaults to statistical', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdict = {
    producedAt: new Date(now.getTime() - 60 * day).toISOString(),
  }
  const f = computeFreshness(verdict, null, now)
  // 60-day-old statistical: exp(-60/30) ≈ 0.135
  assert.ok(f.freshness < 0.2)
})

test('summariseFreshness reports stale fraction correctly', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const verdicts = [
    { producedAt: new Date(now.getTime() - 60 * day).toISOString(), claimType: 'statistical' as const },
    { producedAt: new Date(now.getTime() - 1 * day).toISOString(), claimType: 'statistical' as const },
    { producedAt: new Date(now.getTime() - 1 * day).toISOString(), claimType: 'historical' as const },
  ]
  const s = summariseFreshness(verdicts, now)
  assert.equal(s.total, 3)
  assert.equal(s.stale, 1)
  assert.equal(s.hasStale, true)
})

test('HALF_LIFE_DAYS contains every ClaimType', () => {
  // Belt-and-braces — if a new ClaimType is added without a half-life entry,
  // computeFreshness will fall back silently to statistical via the default
  // branch. This test catches the omission at the table level.
  const expected = [
    'statistical',
    'causal',
    'historical',
    'predictive',
    'normative',
    'scientific_consensus',
    'political_position',
  ]
  for (const t of expected) {
    assert.ok(t in HALF_LIFE_DAYS, `missing half-life entry for ${t}`)
  }
})
