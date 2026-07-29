import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adversarialReview } from '../../lib/agents/adversarial'
import type { Verdict } from '../../lib/types'

// We stub the underlying search and LLM functions by reaching into the
// retrieval module. The tests assert behaviour, not network calls.

function baseVerdict(label: Verdict['label']): Verdict {
  return {
    id: 'v1',
    claimId: 'c1',
    speaker: 'A',
    timestamp: '0:00',
    claimText: 'The earth is round',
    label,
    confidencePct: 95,
    explanation: '',
    evidence: [],
    searchQueries: ['earth round'],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  }
}

const stubModel = {
  invoke: () => Promise.resolve({ content: '{"stance":"NEUTRAL","credibilityScore":50,"rationale":"n/a"}' }),
}

test('FALSE verdict → no adversarial pass (short-circuit)', async () => {
  const v = baseVerdict('FALSE')
  const out = await adversarialReview(v, 'q', stubModel)
  assert.equal(out.downgraded, false)
  assert.equal(out.counterEvidence.length, 0)
  assert.equal(out.verdict.label, 'FALSE')
})

test('MISLEADING verdict → no adversarial pass', async () => {
  const v = baseVerdict('MISLEADING')
  const out = await adversarialReview(v, 'q', stubModel)
  assert.equal(out.verdict.label, 'MISLEADING')
})

test('UNVERIFIED verdict → no adversarial pass', async () => {
  const v = baseVerdict('UNVERIFIED')
  const out = await adversarialReview(v, 'q', stubModel)
  assert.equal(out.verdict.label, 'UNVERIFIED')
})

test('CONTESTED verdict → no adversarial pass (already adversarial)', async () => {
  const v = baseVerdict('CONTESTED')
  const out = await adversarialReview(v, 'q', stubModel)
  assert.equal(out.verdict.label, 'CONTESTED')
})

test('VERIFIED verdict invokes adversarial pass and stays VERIFIED when no counter found', async () => {
  // With no TAVILY_API_KEY set in the test process, searchTavilyWithStatus
  // returns { configured: false }, which the adversarialReview short-circuits.
  const original = process.env.TAVILY_API_KEY
  delete process.env.TAVILY_API_KEY
  try {
    const v = baseVerdict('VERIFIED')
    const out = await adversarialReview(v, 'earth round', stubModel)
    assert.equal(out.downgraded, false)
    assert.equal(out.verdict.label, 'VERIFIED')
    assert.equal(out.counterEvidence.length, 0)
  } finally {
    if (original !== undefined) process.env.TAVILY_API_KEY = original
  }
})
