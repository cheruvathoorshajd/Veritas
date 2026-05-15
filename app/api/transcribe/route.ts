import { NextResponse } from 'next/server'
import { transcribeFile, TranscriptionError } from '@/lib/transcription/assemblyai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 100 * 1024 * 1024

export async function POST(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 100MB limit' }, { status: 413 })
  }
  const typeOk = file.type.startsWith('audio/') || file.type.startsWith('video/') || !file.type
  if (!typeOk) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 422 })
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const lines = await transcribeFile(buffer, file.name)
    return NextResponse.json({ lines })
  } catch (err) {
    if (err instanceof TranscriptionError) {
      return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
    }
    return NextResponse.json(
      { error: (err as Error).message || 'Transcription failed' },
      { status: 500 },
    )
  }
}
