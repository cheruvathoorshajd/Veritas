import { NextResponse } from 'next/server'
import { setVerdictApproval, SessionNotFoundError, SessionStorageError } from '@/lib/db/sessions'

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
    return NextResponse.json({ ok: true, verdict })
  } catch (err) {
    if (err instanceof SessionNotFoundError) {
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
