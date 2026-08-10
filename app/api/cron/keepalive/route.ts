import { NextResponse } from 'next/server'
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/db/client'
import { logger } from '@/lib/utils/logger'

// Scheduled keep-alive + smoke test. Vercel Cron hits this on a schedule (see
// vercel.json). It calls /api/health, which lightly exercises every provider
// key (Gemini, Tavily, AssemblyAI) AND queries Supabase. That does two jobs:
//   1. Resets Supabase's free-tier idle timer so the project never auto-pauses
//      (~7 idle days) — Supabase is the ONLY thing here that pauses.
//   2. Surfaces a broken/expired/quota-exhausted key in the logs before a real
//      portfolio visitor ever hits it.
// API keys and the Vercel deployment itself do not expire from inactivity, so
// this is monitoring/insurance, not a literal "keep the keys alive".
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const log = logger('cron:keepalive')

function baseUrl(): string | null {
  // VERCEL_URL is injected automatically on every Vercel deployment.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  return null
}

async function touchSupabaseDirect(): Promise<string> {
  if (!isSupabaseConfigured()) return 'unconfigured'
  try {
    const sb = getSupabaseServer()
    const { error } = await sb
      .from('sessions')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    return error ? `error: ${error.message}` : 'awake'
  } catch (e) {
    return `unreachable: ${e instanceof Error ? e.message : String(e)}`
  }
}

export async function GET(req: Request): Promise<Response> {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is
  // set. Enforce it only when configured so the route still works without it.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const ts = new Date().toISOString()
  const base = baseUrl()

  // Preferred path: full smoke test via /api/health (exercises every key +
  // touches Supabase).
  if (base) {
    try {
      const res = await fetch(`${base}/api/health`, { cache: 'no-store' })
      const health = await res.json()
      log.info('keep-alive via health', { services: health?.services })
      return NextResponse.json({ ok: res.ok, ts, mode: 'health', health })
    } catch (e) {
      log.warn(
        `health self-check failed, falling back to direct supabase touch: ${
          e instanceof Error ? e.message : String(e)
        }`,
      )
    }
  }

  // Fallback: if the self-fetch failed (or no base URL), at least keep Supabase
  // awake so the free-tier project doesn't pause.
  const supabase = await touchSupabaseDirect()
  const ok = supabase === 'awake' || supabase === 'unconfigured'
  return NextResponse.json({ ok, ts, mode: 'supabase-direct', supabase })
}
