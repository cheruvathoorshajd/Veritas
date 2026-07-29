import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  renderReportJson,
  renderReportMarkdown,
} from '../../lib/report/formats'
import type { Session } from '../../lib/types'

function mockSession(): Session {
  return {
    id: 'abc-123',
    createdAt: '2026-06-01T00:00:00Z',
    inputMode: 'text',
    stage: 'complete',
    error: null,
    transcriptLines: [],
    claims: [],
    speakers: [
      {
        id: 'A',
        label: 'Speaker A',
        claimsTotal: 2,
        claimsVerified: 1,
        claimsFalse: 1,
        claimsMisleading: 0,
        claimsUnverified: 0,
        claimsContested: 0,
        accuracyPct: 50,
      },
    ],
    verdicts: [
      {
        id: 'v1',
        claimId: 'c1',
        speaker: 'A',
        timestamp: '0:00',
        claimText: 'The earth is round',
        label: 'VERIFIED',
        confidencePct: 95,
        explanation: 'Confirmed by multiple primary sources.',
        evidence: [
          {
            source: 'nasa.gov',
            url: 'https://nasa.gov/earth',
            excerpt: 'The Earth is an oblate spheroid.',
            stance: 'SUPPORTS',
            credibilityScore: 95,
          },
        ],
        searchQueries: ['earth round'],
        iterationsUsed: 1,
        approvalRequired: false,
        approved: null,
      },
      {
        id: 'v2',
        claimId: 'c2',
        speaker: 'A',
        timestamp: '0:30',
        claimText: 'Vaccines cause autism',
        label: 'FALSE',
        confidencePct: 99,
        explanation: 'Refuted by extensive peer-reviewed research.',
        evidence: [],
        searchQueries: [],
        iterationsUsed: 1,
        approvalRequired: false,
        approved: null,
      },
    ],
  }
}

test('JSON export is valid JSON and round-trips', () => {
  const session = mockSession()
  const json = renderReportJson(session)
  const parsed = JSON.parse(json)
  assert.equal(parsed.id, 'abc-123')
  assert.equal(parsed.verdicts.length, 2)
})

test('JSON export sorts keys deterministically', () => {
  const session = mockSession()
  const json1 = renderReportJson(session)
  const json2 = renderReportJson(session)
  assert.equal(json1, json2)
})

test('Markdown export contains expected sections', () => {
  const md = renderReportMarkdown(mockSession())
  assert.ok(md.startsWith('# Veritas Fact-Check Report'))
  assert.ok(md.includes('## Per-speaker accuracy'))
  assert.ok(md.includes('## Verdicts'))
  assert.ok(md.includes('### Speaker A'))
  assert.ok(md.includes('VERIFIED'))
  assert.ok(md.includes('FALSE'))
})

test('Markdown export omits per-speaker table when speakers empty', () => {
  const session = mockSession()
  session.speakers = []
  const md = renderReportMarkdown(session)
  assert.ok(!md.includes('## Per-speaker accuracy'))
})

test('Markdown export handles zero verdicts gracefully', () => {
  const session = mockSession()
  session.verdicts = []
  const md = renderReportMarkdown(session)
  assert.ok(md.includes('No verdicts recorded.'))
})

test('Markdown export includes evidence sources', () => {
  const md = renderReportMarkdown(mockSession())
  assert.ok(md.includes('nasa.gov'))
  assert.ok(md.includes('https://nasa.gov/earth'))
})

test('Markdown export shows counter-evidence section when present', () => {
  const session = mockSession()
  session.verdicts[0].counterEvidence = [
    {
      source: 'critic.org',
      url: 'https://critic.org/dissent',
      excerpt: 'Actually flat.',
      stance: 'CONTRADICTS',
      credibilityScore: 30,
    },
  ]
  const md = renderReportMarkdown(session)
  assert.ok(md.includes('**Counter-evidence:**'))
  assert.ok(md.includes('critic.org'))
})

test('Markdown export surfaces rhetorical pattern badge', () => {
  const session = mockSession()
  session.verdicts[0].rhetoricalPattern = 'appeal_to_authority'
  const md = renderReportMarkdown(session)
  assert.ok(md.includes('appeal_to_authority'))
})
