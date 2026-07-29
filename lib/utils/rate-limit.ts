import { logger } from './logger'

/**
 * Rate limiter with two backends:
 *
 * 1. **Upstash Redis** (preferred for production) — when
 *    `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, every
 *    limit check is an `INCR` over the REST API. Survives serverless cold
 *    starts and works across instances/regions.
 *
 * 2. **In-memory `Map`** (local dev + emergency fallback) — used when
 *    Upstash isn't configured, and as a soft fallback if a Redis call
 *    fails. Only protects a single Node process; emits a one-shot warning
 *    in production.
 *
 * Each call can pass multiple windows (e.g. 3/min + 50/day) and is denied
 * the moment any window is exhausted. `hitWindow` tells callers which one
 * tripped so the UI can show a useful message.
 */

const log = logger('rate-limit')

export interface RateWindow {
  max: number
  windowSeconds: number
  /** human-readable label surfaced in 429 responses, e.g. 'per-minute' */
  label: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
  hitWindow?: string
}

// ---------------------------------------------------------------- in-memory

interface MemBucket {
  count: number
  expiresAt: number
}

const memBuckets = new Map<string, MemBucket>()
let memWarned = false

function memWarn(): void {
  if (memWarned) return
  if (process.env.NODE_ENV !== 'production') return
  memWarned = true
  log.warn(
    'Rate limit is in-memory and only protects a single instance. Set ' +
      'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for cross-instance ' +
      'protection on Vercel.',
  )
}

function memLimit(key: string, w: RateWindow): RateLimitResult {
  const now = Date.now()
  const bk = `${key}:${w.windowSeconds}`
  const bucket = memBuckets.get(bk)
  if (!bucket || now >= bucket.expiresAt) {
    memBuckets.set(bk, { count: 1, expiresAt: now + w.windowSeconds * 1000 })
    return { allowed: true, remaining: w.max - 1, retryAfterSeconds: 0 }
  }
  if (bucket.count >= w.max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
      hitWindow: w.label,
    }
  }
  bucket.count += 1
  return { allowed: true, remaining: w.max - bucket.count, retryAfterSeconds: 0 }
}

// ---------------------------------------------------------------- Upstash

interface UpstashConfig {
  url: string
  token: string
}

let upstashCached: UpstashConfig | null | undefined = undefined

function upstashConfig(): UpstashConfig | null {
  if (upstashCached !== undefined) return upstashCached
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  upstashCached = url && token ? { url: url.replace(/\/$/, ''), token } : null
  return upstashCached
}

async function upstashCmd(
  cfg: UpstashConfig,
  args: (string | number)[],
): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    // Upstash REST has its own timeout; keep this short on Vercel.
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Upstash HTTP ${res.status}`)
  }
  const data = (await res.json()) as { result?: unknown; error?: string }
  if (data.error) throw new Error(`Upstash error: ${data.error}`)
  return data.result
}

async function upstashLimit(
  cfg: UpstashConfig,
  key: string,
  w: RateWindow,
): Promise<RateLimitResult> {
  const bk = `rl:${key}:${w.windowSeconds}`
  try {
    const count = (await upstashCmd(cfg, ['INCR', bk])) as number
    if (count === 1) {
      // First hit in the window — anchor the TTL.
      await upstashCmd(cfg, ['EXPIRE', bk, w.windowSeconds])
    }
    if (count > w.max) {
      const ttl = (await upstashCmd(cfg, ['TTL', bk])) as number
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: ttl > 0 ? ttl : w.windowSeconds,
        hitWindow: w.label,
      }
    }
    return { allowed: true, remaining: Math.max(0, w.max - count), retryAfterSeconds: 0 }
  } catch (err) {
    log.warn(
      `Upstash limit ${bk} failed (${(err as Error).message}); falling back to in-memory for this check.`,
    )
    return memLimit(key, w)
  }
}

// ---------------------------------------------------------------- public

/**
 * Check `key` against every window in order. Returns the first denial it
 * encounters, or `allowed: true` if all windows pass.
 */
export async function rateLimit(
  key: string,
  windows: RateWindow[],
): Promise<RateLimitResult> {
  const cfg = upstashConfig()
  if (!cfg) memWarn()

  // Track the tightest remaining-budget across all windows so callers see
  // the most-constraining number when everything passes.
  let tightest: RateLimitResult = { allowed: true, remaining: Infinity, retryAfterSeconds: 0 }
  for (const w of windows) {
    const res = cfg ? await upstashLimit(cfg, key, w) : memLimit(key, w)
    if (!res.allowed) return res
    if (res.remaining < tightest.remaining) tightest = res
  }
  return tightest
}

/** Convenience for routes that only want a single window. */
export async function rateLimitSimple(
  key: string,
  max: number,
  windowSeconds: number,
  label = 'per-window',
): Promise<RateLimitResult> {
  return rateLimit(key, [{ max, windowSeconds, label }])
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  const cfip = req.headers.get('cf-connecting-ip')
  if (cfip) return cfip
  return 'local'
}

/** Shape callers should return on 429. Keeps response bodies consistent. */
export function rateLimitResponseBody(rl: RateLimitResult, endpoint: string): {
  error: string
  code: 'rate_limited'
  retryAfterSeconds: number
  hitWindow?: string
} {
  return {
    error: `Too many ${endpoint} requests${rl.hitWindow ? ` (${rl.hitWindow})` : ''}. Try again in ${rl.retryAfterSeconds}s.`,
    code: 'rate_limited',
    retryAfterSeconds: rl.retryAfterSeconds,
    hitWindow: rl.hitWindow,
  }
}
