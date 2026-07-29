import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit, rateLimitSimple, clientKey } from '../../lib/utils/rate-limit'

test('rateLimit allows up to max within the window', async () => {
  const key = `unit:${Math.random()}`
  for (let i = 0; i < 5; i++) {
    const r = await rateLimitSimple(key, 5, 60, 'per-minute')
    assert.equal(r.allowed, true, `iteration ${i} should be allowed`)
    assert.equal(r.remaining, 5 - 1 - i)
  }
})

test('rateLimit blocks once max is exceeded', async () => {
  const key = `unit:${Math.random()}`
  for (let i = 0; i < 3; i++) await rateLimitSimple(key, 3, 60)
  const blocked = await rateLimitSimple(key, 3, 60)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.remaining, 0)
  assert.ok(blocked.retryAfterSeconds > 0)
})

test('rateLimit isolates different keys', async () => {
  const a = `unit:a:${Math.random()}`
  const b = `unit:b:${Math.random()}`
  for (let i = 0; i < 2; i++) await rateLimitSimple(a, 2, 60)
  const aBlocked = await rateLimitSimple(a, 2, 60)
  const bAllowed = await rateLimitSimple(b, 2, 60)
  assert.equal(aBlocked.allowed, false)
  assert.equal(bAllowed.allowed, true)
})

test('rateLimit denies on first exhausted window in a multi-window check', async () => {
  const key = `unit:multi:${Math.random()}`
  // minute window has only 2 hits; daily has 10.
  await rateLimit(key, [
    { max: 2, windowSeconds: 60, label: 'per-minute' },
    { max: 10, windowSeconds: 86_400, label: 'per-day' },
  ])
  await rateLimit(key, [
    { max: 2, windowSeconds: 60, label: 'per-minute' },
    { max: 10, windowSeconds: 86_400, label: 'per-day' },
  ])
  const blocked = await rateLimit(key, [
    { max: 2, windowSeconds: 60, label: 'per-minute' },
    { max: 10, windowSeconds: 86_400, label: 'per-day' },
  ])
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.hitWindow, 'per-minute')
})

test('clientKey reads x-forwarded-for', () => {
  const req = new Request('http://x', {
    headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
  })
  assert.equal(clientKey(req), '203.0.113.5')
})

test('clientKey falls back to x-real-ip', () => {
  const req = new Request('http://x', { headers: { 'x-real-ip': '198.51.100.7' } })
  assert.equal(clientKey(req), '198.51.100.7')
})

test('clientKey reads cf-connecting-ip', () => {
  const req = new Request('http://x', { headers: { 'cf-connecting-ip': '192.0.2.4' } })
  assert.equal(clientKey(req), '192.0.2.4')
})

test('clientKey defaults to local when no headers', () => {
  const req = new Request('http://x')
  assert.equal(clientKey(req), 'local')
})
