import { NextResponse } from 'next/server'
import { parseTranscriptFromText } from '@/lib/transcription/web-speech'
import { rateLimit, clientKey, rateLimitResponseBody } from '@/lib/utils/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'

function detectKind(file: File): 'docx' | 'pdf' | null {
  const name = file.name.toLowerCase()
  if (file.type === DOCX_MIME || name.endsWith('.docx')) return 'docx'
  if (file.type === PDF_MIME || name.endsWith('.pdf')) return 'pdf'
  return null
}

/**
 * Phase 2C — Validate by magic bytes, not just extension/MIME. A `.docx`
 * with a PDF header (or vice versa) would crash the extractor with a
 * misleading error; rejecting at the route boundary keeps the failure
 * mode clean. PDFs start with "%PDF-"; docx is a ZIP container so it
 * starts with "PK" (0x50 0x4B).
 */
function magicByteKind(buffer: Buffer): 'docx' | 'pdf' | null {
  if (buffer.length < 4) return null
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf'
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
    // ZIP container — could be docx, xlsx, pptx, or just a zip. We accept
    // it as a docx candidate and let mammoth surface a meaningful error
    // if the content isn't Word XML.
    return 'docx'
  }
  return null
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value ?? ''
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText({ pageJoiner: '' })
    return result.text ?? ''
  } finally {
    await parser.destroy().catch(() => {})
  }
}

export async function POST(req: Request) {
  // Document parsing burns CPU on the serverless instance; cap aggressively.
  const rl = await rateLimit(`transcribe:${clientKey(req)}`, [
    { max: 5, windowSeconds: 60, label: 'per-minute' },
    { max: 30, windowSeconds: 86_400, label: 'per-day' },
  ])
  if (!rl.allowed) {
    return NextResponse.json(rateLimitResponseBody(rl, 'transcribe'), {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSeconds) },
    })
  }

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
    return NextResponse.json({ error: 'File exceeds 25MB limit' }, { status: 413 })
  }
  const kind = detectKind(file)
  if (!kind) {
    return NextResponse.json(
      { error: 'Only .docx (Word) and .pdf files are accepted' },
      { status: 422 },
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const magic = magicByteKind(buffer)
    if (magic !== null && magic !== kind) {
      return NextResponse.json(
        {
          error: `File extension (.${kind}) does not match its actual content (looks like .${magic}). Reject and re-upload the correct file.`,
        },
        { status: 415 },
      )
    }
    const text = kind === 'docx' ? await extractDocx(buffer) : await extractPdf(buffer)
    if (!text.trim()) {
      return NextResponse.json(
        { error: 'No extractable text found in the document' },
        { status: 422 },
      )
    }
    const lines = parseTranscriptFromText(text)
    if (!lines.length) {
      return NextResponse.json(
        { error: 'Document text could not be parsed into transcript lines' },
        { status: 422 },
      )
    }
    return NextResponse.json({ lines })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to read document' },
      { status: 500 },
    )
  }
}
