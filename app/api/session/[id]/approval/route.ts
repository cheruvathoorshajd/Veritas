import { NextResponse } from 'next/server'
import {
  setVerdictApproval,
  SessionNotFoundError,
  SessionStorageError,
  isMemoryMode,
} from '@/lib/db/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ApprovalBody {
  verdictId?: unknown
  approved?: unknown
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let body: ApprovalBody
  try {
    body = (await req.json()) as ApprovalBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body.verdictId !== 'string' || !body.verdictId) {
    return NextResponse.json({ error: 'verdictId is required' }, { status: 400 })
  }
  if (typeof body.approved !== 'boolean') {
    return NextResponse.json({ error: 'approved must be a boolean' }, { status: 400 })
  }

  try {
    const verdict = await setVerdictApproval(params.id, body.verdictId, body.approved)
    return NextResponse.json({ ok: true, verdict, persisted: true })
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
      // Without Supabase, sessions live in a per-instance Map. A POST that
      // lands on a different serverless instance than the one that owns
      // the session will look up an empty Map and miss — that's not a
      // bug, it's an architectural fact of running stateless on Vercel.
      // Signal "client-only acceptance" so the UI keeps its optimistic
      // state and surfaces an advisory rather than a hard error.
      if (isMemoryMode()) {
        return NextResponse.json(
          { ok: true, verdict: null, persisted: false },
          { status: 200, headers: { 'X-Veritas-Approval': 'client-only' } },
        )
      }
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof SessionStorageError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to record approval' },
      { status: 500 },
    )
  }
}
