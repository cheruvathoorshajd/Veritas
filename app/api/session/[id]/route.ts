import { NextResponse } from 'next/server'
import { getSession } from '@/lib/db/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession(params.id)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    return NextResponse.json(session)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch session' },
      { status: 500 },
    )
  }
}
