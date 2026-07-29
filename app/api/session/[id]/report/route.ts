import { NextResponse } from 'next/server'
import { getSession } from '@/lib/db/sessions'
import { renderReportHtml } from '@/lib/report/render'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSession(params.id)
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
  return new Response(renderReportHtml(session), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
