import { NextResponse } from 'next/server'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { AssemblyAI } from 'assemblyai'
import { searchTavily } from '@/lib/retrieval/tavily'
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/db/client'
import { cacheStats } from '@/lib/cache/verdict-cache'
import { checkPipelineEnv } from '@/lib/utils/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'ok' | 'error' | 'unconfigured' | 'timeout'

const CHECK_TIMEOUT_MS = 5_000

// Module-load epoch used to compute uptime. In a serverless environment
// this resets per cold start — accurate enough for an at-a-glance probe.
const STARTED_AT_MS = Date.now()

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race<T | 'timeout'>([
    Promise.resolve(p),
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ])
}

async function checkGemini(): Promise<{ status: Status; latencyMs: number | null }> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { status: 'unconfigured', latencyMs: null }
  }
  const t0 = Date.now()
  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      model: 'gemini-2.0-flash',
      maxOutputTokens: 8,
      temperature: 0,
    })
    const r = await withTimeout(model.invoke('ok'), CHECK_TIMEOUT_MS)
    return { status: r === 'timeout' ? 'timeout' : 'ok', latencyMs: Date.now() - t0 }
  } catch {
    return { status: 'error', latencyMs: Date.now() - t0 }
  }
}

async function checkTavily(): Promise<{ status: Status; latencyMs: number | null }> {
  if (!process.env.TAVILY_API_KEY) return { status: 'unconfigured', latencyMs: null }
  const t0 = Date.now()
  try {
    const r = await withTimeout(searchTavily('test', 1), CHECK_TIMEOUT_MS)
    if (r === 'timeout') return { status: 'timeout', latencyMs: Date.now() - t0 }
    return { status: Array.isArray(r) ? 'ok' : 'error', latencyMs: Date.now() - t0 }
  } catch {
    return { status: 'error', latencyMs: Date.now() - t0 }
  }
}

async function checkAssembly(): Promise<{ status: Status; latencyMs: number | null }> {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return { status: 'unconfigured', latencyMs: null }
  }
  const t0 = Date.now()
  try {
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY })
    const r = await withTimeout(client.transcripts.list({ limit: 1 }), CHECK_TIMEOUT_MS)
    return { status: r === 'timeout' ? 'timeout' : 'ok', latencyMs: Date.now() - t0 }
  } catch {
    return { status: 'error', latencyMs: Date.now() - t0 }
  }
}

async function checkSupabase(): Promise<{ status: Status; latencyMs: number | null }> {
  if (!isSupabaseConfigured()) return { status: 'unconfigured', latencyMs: null }
  const t0 = Date.now()
  try {
    const sb = getSupabaseServer()
    const r = await withTimeout(
      sb.from('sessions').select('id').limit(1),
      CHECK_TIMEOUT_MS,
    )
    if (r === 'timeout') return { status: 'timeout', latencyMs: Date.now() - t0 }
    return { status: r.error ? 'error' : 'ok', latencyMs: Date.now() - t0 }
  } catch {
    return { status: 'error', latencyMs: Date.now() - t0 }
  }
}

export async function GET() {
  const startedAt = Date.now()
  const [gemini, tavily, assembly, supabase] = await Promise.all([
    checkGemini(),
    checkTavily(),
    checkAssembly(),
    checkSupabase(),
  ])

  const services = {
    gemini: gemini.status,
    tavily: tavily.status,
    assemblyai: assembly.status,
    supabase: supabase.status,
  }
  const hasError = Object.values(services).some(
    (s) => s === 'error' || s === 'timeout',
  )

  const env = checkPipelineEnv()

  return NextResponse.json(
    {
      status: hasError ? 'degraded' : env.ok ? 'ok' : 'unconfigured',
      services,
      external_api_latency_ms: {
        gemini: gemini.latencyMs,
        tavily: tavily.latencyMs,
        assemblyai: assembly.latencyMs,
        supabase: supabase.latencyMs,
      },
      cache: cacheStats(),
      sessionStore: isSupabaseConfigured() ? 'supabase' : 'in-memory',
      env: process.env.NODE_ENV ?? 'unknown',
      requiredEnvOk: env.ok,
      requiredEnvMissing: env.missing,
      uptimeSeconds: Math.floor((Date.now() - STARTED_AT_MS) / 1000),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
