interface Bucket {
  count: number
  windowStart: number
}

const WINDOW_MS = 60_000

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function rateLimit(key: string, max = 10, windowMs = WINDOW_MS): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 }
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.windowStart + windowMs - now) / 1000),
    }
  }
  bucket.count += 1
  return { allowed: true, remaining: max - bucket.count, retryAfterSeconds: 0 }
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'local'
}
