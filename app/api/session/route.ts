import { NextResponse } from 'next/server'
import { createSession } from '@/lib/db/sessions'
import type { InputMode } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_MODES = new Set<InputMode>(['mic', 'file', 'text'])

export async function POST(req: Request) {
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
    return NextResponse.json({ sessionId: session.id, session })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create session' },
      { status: 500 },
    )
  }
}
