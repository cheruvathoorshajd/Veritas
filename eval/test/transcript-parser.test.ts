import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTranscriptFromText } from '../../lib/transcription/web-speech'

test('parses unprefixed text as single speaker A', () => {
  const lines = parseTranscriptFromText('The earth is round. The sky is blue.')
  assert.equal(lines.length, 2)
  assert.ok(lines.every((l) => l.speaker === 'A'))
  assert.equal(lines[0].text, 'The earth is round.')
})

test('honours "Speaker A:" / "Speaker B:" prefixes', () => {
  const input = `Speaker A: Inflation is 3 percent.
Speaker B: That's wrong, it's 2 percent.`
  const lines = parseTranscriptFromText(input)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].speaker, 'A')
  assert.equal(lines[1].speaker, 'B')
})

test('handles compact "A:" prefix form', () => {
  const lines = parseTranscriptFromText('A: hello.\nB: hi back.')
  assert.equal(lines[0].speaker, 'A')
  assert.equal(lines[1].speaker, 'B')
})

test('preserves trailing-dot abbreviations during sentence split', () => {
  // Single-dot titles (Dr., Mr., Mrs.) must not trigger a sentence break.
  // Multi-dot forms with interior periods (p.m., e.g., i.e.) are partially
  // handled by the protector but not exhaustively — see lib/transcription/
  // web-speech.ts ABBREVIATIONS regex.
  const lines = parseTranscriptFromText('Dr. Smith met Mr. Jones at noon yesterday.')
  assert.equal(lines.length, 1)
  assert.ok(lines[0].text.includes('Dr. Smith'))
  assert.ok(lines[0].text.includes('Mr. Jones'))
})

test('returns empty array for empty input', () => {
  assert.deepEqual(parseTranscriptFromText(''), [])
  assert.deepEqual(parseTranscriptFromText('   \n  '), [])
})

test('assigns monotonically increasing timestamps', () => {
  const lines = parseTranscriptFromText('one. two. three. four.')
  for (let i = 1; i < lines.length; i++) {
    assert.ok(
      lines[i].startMs >= lines[i - 1].endMs,
      `line ${i} should start after line ${i - 1} ends`,
    )
  }
})
