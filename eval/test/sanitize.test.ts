import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitiseForPrompt,
  sanitiseUrl,
  delimitUntrusted,
} from '../../lib/utils/sanitize'

test('sanitiseForPrompt strips control characters', () => {
  const dirty = 'hello\x00\x07world\x1b'
  assert.equal(sanitiseForPrompt(dirty), 'hello  world')
})

test('sanitiseForPrompt preserves newlines and tabs', () => {
  assert.equal(sanitiseForPrompt('line1\nline2\tcol'), 'line1\nline2\tcol')
})

test('sanitiseForPrompt clamps long input with ellipsis', () => {
  const long = 'a'.repeat(5000)
  const out = sanitiseForPrompt(long, 100)
  assert.equal(out.length, 101)
  assert.ok(out.endsWith('…'))
})

test('sanitiseForPrompt normalises curly quotes', () => {
  assert.equal(sanitiseForPrompt('“hello” ‘world’'), '"hello" \'world\'')
})

test('sanitiseUrl strips credentials', () => {
  assert.equal(
    sanitiseUrl('https://user:pass@example.com/path?q=1'),
    'https://example.com/path?q=1',
  )
})

test('sanitiseUrl rejects javascript: URLs', () => {
  assert.equal(sanitiseUrl('javascript:alert(1)'), '')
})

test('sanitiseUrl rejects data: URLs', () => {
  assert.equal(sanitiseUrl('data:text/html,<script>'), '')
})

test('sanitiseUrl returns empty for invalid input', () => {
  assert.equal(sanitiseUrl('not a url'), '')
  assert.equal(sanitiseUrl(''), '')
})

test('delimitUntrusted wraps content in named tags', () => {
  const out = delimitUntrusted('claim', 'the sky is blue')
  assert.ok(out.startsWith('<claim>\n'))
  assert.ok(out.endsWith('\n</claim>'))
  assert.ok(out.includes('the sky is blue'))
})

test('delimitUntrusted sanitises body', () => {
  const out = delimitUntrusted('evidence', 'evil\x00content')
  assert.ok(!out.includes('\x00'))
})
