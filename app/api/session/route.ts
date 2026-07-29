import { NextResponse } from 'next/server'
import { createSession } from '@/lib/db/sessions'
import { rateLimit, clientKey, rateLimitResponseBody } from '@/lib/utils/rate-limit'
import type { InputMode } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_MODES = new Set<InputMode>(['mic', 'file', 'text'])

export async function POST(req: Request) {
  const rl = await rateLimit(`session:${clientKey(req)}`, [
    { max: 20, windowSeconds: 60, label: 'per-minute' },
    { max: 200, windowSeconds: 86_400, label: 'per-day' },
  ])
  if (!rl.allowed) {
    return NextResponse.json(rateLimitResponseBody(rl, 'session'), {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSeconds) },
    })
  }

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const inputMode = (body as { inputMode?: string }).inputMode as InputMode | undefined
  const mode: InputMode = inputMode && VALID_MODES.has(inputMode) ? inputMode : 'text'
  try {
    const session = await createSession(mode)
    // The approval token is returned exactly once here. Callers must keep
    // it client-side; subsequent GETs do NOT echo it back.
    const { approvalToken, ...sessionForClient } = session
    return NextResponse.json({
      sessionId: session.id,
      approvalToken,
      session: sessionForClient,
    })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create session' },
      { status: 500 },
    )
  }
}
