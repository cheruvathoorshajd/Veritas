import { NextResponse } from 'next/server'
import {
  setVerdictApproval,
  SessionNotFoundError,
  SessionStorageError,
  ApprovalTokenError,
  isMemoryMode,
} from '@/lib/db/sessions'
import { rateLimit, clientKey, rateLimitResponseBody } from '@/lib/utils/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ApprovalBody {
  verdictId?: unknown
  approved?: unknown
}

function extractToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!auth) return null
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim())
  return m ? m[1].trim() : null
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const rl = await rateLimit(`approval:${clientKey(req)}`, [
    { max: 30, windowSeconds: 60, label: 'per-minute' },
  ])
  if (!rl.allowed) {
    return NextResponse.json(rateLimitResponseBody(rl, 'approval'), {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSeconds) },
    })
  }

  const token = extractToken(req)
  if (!token) {
    return NextResponse.json(
      {
        error: 'Missing approval token. Reload the session to issue a new one.',
        code: 'missing_token',
      },
      { status: 401 },
    )
  }

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
    const verdict = await setVerdictApproval(params.id, body.verdictId, body.approved, token)
    return NextResponse.json({ ok: true, verdict, persisted: true })
  } catch (err) {
    if (err instanceof ApprovalTokenError) {
      return NextResponse.json(
        {
          error: 'Approval token does not match this session.',
          code: 'invalid_token',
        },
        { status: 401 },
      )
    }
    if (err instanceof SessionNotFoundError) {
      // Without Supabase, sessions live in a per-instance Map. A POST that
      // lands on a different serverless instance than the one that owns
      // the session will look up an empty Map and miss — that's not a
      // bug, it's an architectural fact of running stateless on Vercel.
      // Signal "client-only acceptance" so the UI keeps its optimistic
      // state and surfaces an advisory rather than a hard error.
      if (isMemoryMode()) {
        return NextResponse.json(
          { ok: true, verdict: null, persisted: false, code: 'client_only' },
          { status: 200, headers: { 'X-Veritas-Approval': 'client-only' } },
        )
      }
      return NextResponse.json({ error: err.message, code: 'not_found' }, { status: 404 })
    }
    if (err instanceof SessionStorageError) {
      return NextResponse.json({ error: err.message, code: 'storage_error' }, { status: 404 })
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to record approval', code: 'unknown' },
      { status: 500 },
    )
  }
}
