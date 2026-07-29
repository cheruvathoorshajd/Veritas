import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'

const log = logger('db')

let cached: SupabaseClient | null = null
let inMemoryWarningShown = false

export function getSupabaseServer(): SupabaseClient {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    )
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

/**
 * Loud one-shot warning when the app falls back to per-process in-memory
 * storage in a production environment. In-memory mode silently breaks across
 * serverless instances — approvals get dropped, share-links 404, the report
 * route can't find sessions created by the pipeline route.
 *
 * Called from every storage-touching code path (createSession, getSession,
 * updateSession) but only emits once per process.
 */
export function warnIfInMemoryInProduction(): void {
  if (inMemoryWarningShown) return
  if (process.env.NODE_ENV !== 'production') return
  if (isSupabaseConfigured()) return
  inMemoryWarningShown = true
  log.error(
    'Running in production WITHOUT Supabase — sessions live in per-instance memory and will be lost across requests and restarts. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  )
}
