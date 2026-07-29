import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPipelineEnv, looksLikeSecret } from '../../lib/utils/env'

test('checkPipelineEnv reports missing keys', () => {
  const saved = {
    g: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    t: process.env.TAVILY_API_KEY,
  }
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  delete process.env.TAVILY_API_KEY
  try {
    const r = checkPipelineEnv()
    assert.equal(r.ok, false)
    assert.ok(r.missing.includes('GOOGLE_GENERATIVE_AI_API_KEY'))
    assert.ok(r.missing.includes('TAVILY_API_KEY'))
  } finally {
    if (saved.g !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved.g
    if (saved.t !== undefined) process.env.TAVILY_API_KEY = saved.t
  }
})

test('checkPipelineEnv returns ok when both keys present', () => {
  const saved = {
    g: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    t: process.env.TAVILY_API_KEY,
  }
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'x'
  process.env.TAVILY_API_KEY = 'x'
  try {
    const r = checkPipelineEnv()
    assert.equal(r.ok, true)
    assert.deepEqual(r.missing, [])
  } finally {
    if (saved.g === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = saved.g
    if (saved.t === undefined) delete process.env.TAVILY_API_KEY
    else process.env.TAVILY_API_KEY = saved.t
  }
})

test('looksLikeSecret detects Google API key shape', () => {
  assert.equal(looksLikeSecret('AIza' + 'A'.repeat(32)), true)
})

test('looksLikeSecret detects Groq key shape', () => {
  assert.equal(looksLikeSecret('gsk_' + 'A'.repeat(45)), true)
})

test('looksLikeSecret detects Tavily key shape', () => {
  assert.equal(looksLikeSecret('tvly-' + 'A'.repeat(20)), true)
})

test('looksLikeSecret detects LangSmith key shape', () => {
  assert.equal(looksLikeSecret('lsv2_pt_' + 'A'.repeat(30)), true)
})

test('looksLikeSecret returns false for ordinary strings', () => {
  assert.equal(looksLikeSecret('hello world'), false)
  assert.equal(looksLikeSecret(''), false)
  assert.equal(looksLikeSecret('AI'), false)
})
