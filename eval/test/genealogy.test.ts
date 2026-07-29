import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildGenealogy, propagateFalseWarnings } from '../../lib/genealogy/graph'
import type { ExtractedClaim, Verdict } from '../../lib/types'

function claim(
  id: string,
  text: string,
  speaker: string,
  entities: string[] = [],
): ExtractedClaim {
  return {
    id,
    speaker,
    timestamp: '0:00',
    originalText: text,
    claimText: text,
    searchQuery: text,
    isCheckworthy: true,
    entities,
  }
}

function verdict(claimId: string, label: Verdict['label']): Verdict {
  return {
    id: `v-${claimId}`,
    claimId,
    speaker: 'A',
    timestamp: '0:00',
    claimText: '',
    label,
    confidencePct: 80,
    explanation: '',
    evidence: [],
    searchQueries: [],
    iterationsUsed: 1,
    approvalRequired: false,
    approved: null,
  }
}

test('two claims sharing entity → connected edge', () => {
  const claims = [
    claim('1', 'Inflation hit 9 percent', 'A', ['Federal Reserve']),
    claim('2', 'The Federal Reserve responded by raising rates', 'A', ['Federal Reserve']),
  ]
  const g = buildGenealogy(claims, [])
  assert.equal(g.nodes.length, 2)
  assert.equal(g.edges.length, 1)
  assert.deepEqual(g.edges[0].sharedEntities, ['Federal Reserve'])
})

test('two unrelated claims → no edge', () => {
  const claims = [
    claim('1', 'The capital of Japan is Tokyo', 'A', ['Japan', 'Tokyo']),
    claim('2', 'Mount Everest is 8848 meters', 'B', ['Mount Everest']),
  ]
  const g = buildGenealogy(claims, [])
  assert.equal(g.edges.length, 0)
})

test('isolated claim → valid node with no edges', () => {
  const claims = [claim('only', 'Some standalone claim about ABC123', 'A')]
  const g = buildGenealogy(claims, [])
  assert.equal(g.nodes.length, 1)
  assert.equal(g.edges.length, 0)
})

test('node verdict colour reflects verdict label', () => {
  const claims = [claim('1', 'x', 'A')]
  const verdicts = [verdict('1', 'FALSE')]
  const g = buildGenealogy(claims, verdicts)
  assert.equal(g.nodes[0].verdict, 'FALSE')
})

test('claim with no verdict → UNVERIFIED in graph', () => {
  const claims = [claim('1', 'x', 'A')]
  const g = buildGenealogy(claims, [])
  assert.equal(g.nodes[0].verdict, 'UNVERIFIED')
})

test('high token overlap with no shared entities → still connected', () => {
  const claims = [
    claim('1', 'The economy grew by three percent last quarter', 'A'),
    claim('2', 'Economy grew three percent last quarter according to data', 'A'),
  ]
  const g = buildGenealogy(claims, [])
  assert.ok(g.edges.length >= 1)
})

test('propagateFalseWarnings flags claims sharing an entity with a FALSE-tagged peer', () => {
  const claims = [
    claim('1', 'Vaccines cause autism', 'A', ['vaccines']),
    claim('2', 'Vaccines are required for school', 'A', ['vaccines']),
    claim('3', 'Tokyo is the capital of Japan', 'A', ['Tokyo', 'Japan']),
  ]
  const verdicts = [
    verdict('1', 'FALSE'),
    verdict('2', 'VERIFIED'),
    verdict('3', 'VERIFIED'),
  ]
  const warned = propagateFalseWarnings(claims, verdicts)
  assert.ok(warned.has('2'), 'claim 2 should be warned (shares "vaccines" with claim 1)')
  assert.ok(!warned.has('3'), 'claim 3 should not be warned')
})

test('propagateFalseWarnings respects speaker boundary', () => {
  const claims = [
    claim('1', 'Vaccines cause autism', 'A', ['vaccines']),
    claim('2', 'Vaccines are required for school', 'B', ['vaccines']),
  ]
  const verdicts = [verdict('1', 'FALSE'), verdict('2', 'VERIFIED')]
  // Verdict 2's speaker is B but verdict-1's mock is hard-coded to A.
  // We patch the speaker on verdict 1 to mirror claim 1's speaker.
  verdicts[0].speaker = 'A'
  const warned = propagateFalseWarnings(claims, verdicts)
  // Speaker B's claim should not be warned by speaker A's FALSE claim.
  assert.ok(!warned.has('2'))
})

test('empty input → empty graph', () => {
  const g = buildGenealogy([], [])
  assert.equal(g.nodes.length, 0)
  assert.equal(g.edges.length, 0)
})
