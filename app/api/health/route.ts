import { NextResponse } from 'next/server'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { AssemblyAI } from 'assemblyai'
import { searchTavily } from '@/lib/retrieval/tavily'
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/db/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'ok' | 'error' | 'unconfigured'

async function checkGemini(): Promise<Status> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'unconfigured'
  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      model: 'gemini-2.0-flash',
      maxOutputTokens: 8,
      temperature: 0,
    })
    await model.invoke('ok')
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkTavily(): Promise<Status> {
  if (!process.env.TAVILY_API_KEY) return 'unconfigured'
  try {
    const r = await searchTavily('test', 1)
    return Array.isArray(r) ? 'ok' : 'error'
  } catch {
    return 'error'
  }
}

async function checkAssembly(): Promise<Status> {
  if (!process.env.ASSEMBLYAI_API_KEY) return 'unconfigured'
  try {
    const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY })
    // list a minimal page to verify auth
    await client.transcripts.list({ limit: 1 })
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkSupabase(): Promise<Status> {
  if (!isSupabaseConfigured()) return 'unconfigured'
  try {
    const sb = getSupabaseServer()
    const { error } = await sb.from('sessions').select('id').limit(1)
    return error ? 'error' : 'ok'
  } catch {
    return 'error'
  }
}

export async function GET() {
  const [gemini, tavily, assembly, supabase] = await Promise.all([
    checkGemini(),
    checkTavily(),
    checkAssembly(),
    checkSupabase(),
  ])
  const services = { gemini, tavily, assemblyai: assembly, supabase }
  const hasError = Object.values(services).some((s) => s === 'error')
  return NextResponse.json({
    status: hasError ? 'degraded' : 'ok',
    services,
    timestamp: new Date().toISOString(),
  })
}
