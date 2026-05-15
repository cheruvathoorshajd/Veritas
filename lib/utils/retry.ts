/**
 * Retry an async operation up to `maxRetries` extra attempts (so 1 try + maxRetries retries).
 * Uses exponential backoff: 200ms, 400ms, 800ms, ... capped at 2000ms.
 * Resolves with the operation's value on success, throws the final error otherwise.
 */
export async function withRetry<T>(
  op: () => Promise<T>,
  opts: { maxRetries?: number; label?: string; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  const { maxRetries = 2, label = 'op', shouldRetry } = opts
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await op()
    } catch (err) {
      lastErr = err
      if (shouldRetry && !shouldRetry(err)) throw err
      if (attempt === maxRetries) break
      const delay = Math.min(2000, 200 * 2 ** attempt)
      await new Promise((r) => setTimeout(r, delay))
      console.warn(`[retry:${label}] attempt ${attempt + 1} failed, retrying in ${delay}ms`)
    }
  }
  throw lastErr
}
