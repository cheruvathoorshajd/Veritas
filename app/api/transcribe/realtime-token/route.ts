import { NextResponse } from 'next/server'
import { AssemblyAI } from 'assemblyai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'ASSEMBLYAI_API_KEY is not configured' },
      { status: 500 },
    )
  }
  try {
    const client = new AssemblyAI({ apiKey: key })
    const token = await client.streaming.createTemporaryToken({
      expires_in_seconds: 600,
      max_session_duration_seconds: 3600,
    })
    return NextResponse.json({ token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token issue'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
