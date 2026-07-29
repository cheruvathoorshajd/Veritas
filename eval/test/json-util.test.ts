import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractJsonArray,
  extractJsonObject,
  stripFence,
} from '../../lib/utils/json'

test('stripFence removes ```json fences', () => {
  const input = '```json\n{"a":1}\n```'
  assert.equal(stripFence(input), '{"a":1}')
})

test('stripFence removes plain ``` fences', () => {
  const input = '```\n{"a":1}\n```'
  assert.equal(stripFence(input), '{"a":1}')
})

test('stripFence returns input as-is when no fence', () => {
  assert.equal(stripFence('{"a":1}'), '{"a":1}')
})

test('extractJsonObject parses pure JSON', () => {
  const o = extractJsonObject<{ a: number }>('{"a":1}')
  assert.deepEqual(o, { a: 1 })
})

test('extractJsonObject parses fenced JSON', () => {
  const o = extractJsonObject<{ a: number }>('```json\n{"a":1}\n```')
  assert.deepEqual(o, { a: 1 })
})

test('extractJsonObject finds embedded JSON via regex', () => {
  const o = extractJsonObject<{ b: number }>('preamble {"b":2} trailing')
  assert.deepEqual(o, { b: 2 })
})

test('extractJsonObject returns null on garbage', () => {
  assert.equal(extractJsonObject('not json at all'), null)
})

test('extractJsonArray parses pure JSON array', () => {
  const a = extractJsonArray<number>('[1,2,3]')
  assert.deepEqual(a, [1, 2, 3])
})

test('extractJsonArray handles fenced array', () => {
  const a = extractJsonArray<number>('```\n[4,5]\n```')
  assert.deepEqual(a, [4, 5])
})

test('extractJsonArray finds array within prose', () => {
  const a = extractJsonArray<string>('Here you go: ["a","b"] (end)')
  assert.deepEqual(a, ['a', 'b'])
})

test('extractJsonArray returns null on no array present', () => {
  assert.equal(extractJsonArray('no array here'), null)
})
