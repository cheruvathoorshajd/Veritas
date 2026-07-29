import { createResilientLLM, type ResilientLLM } from '@/lib/agents/llm'
import type { NextRequest } from 'next/server'
import type {
  ExtractedClaim,
  InputMode,
  PipelineStage,
  Speaker,
  TranscriptLine,
  Verdict,
} from '@/lib/types'
import { runVeritasPipeline, type GraphEvent } from '@/lib/agents/graph'
import { createSSEStream } from '@/lib/utils/stream'
import { rateLimit, clientKey, rateLimitResponseBody } from '@/lib/utils/rate-limit'
import { updateSession, getSession, createSession } from '@/lib/db/sessions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface PipelineBody {
  sessionId?: string
  transcriptLines?: TranscriptLine[]
  inputMode?: InputMode
}

const MAX_LINES = 500
const MAX_TEXT_PER_LINE = 5_000
const MAX_TOTAL_CHARS = 200_000

type Validation =
  | { ok: true; lines: TranscriptLine[] }
  | { ok: false; error: string }

function validateTranscriptLines(input: unknown): Validation {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'transcriptLines must be an array' }
  }
  if (input.length === 0) return { ok: false, error: 'transcriptLines is required' }
  if (input.length > MAX_LINES) {
    return { ok: false, error: `Too many transcript lines (max ${MAX_LINES})` }
  }

  let totalChars = 0
  const out: TranscriptLine[] = []
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Partial<TranscriptLine> | undefined
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: `transcriptLines[${i}] is not an object` }
    }
    const text = typeof raw.text === 'string' ? raw.text : ''
    if (!text.trim()) {
      return { ok: false, error: `transcriptLines[${i}].text is empty` }
    }
    if (text.length > MAX_TEXT_PER_LINE) {
      return {
        ok: false,
        error: `transcriptLines[${i}].text exceeds ${MAX_TEXT_PER_LINE} chars`,
      }
    }
    totalChars += text.length
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: `Total transcript size exceeds ${MAX_TOTAL_CHARS} chars` }
    }
    out.push({
      id: typeof raw.id === 'string' ? raw.id : `${Date.now()}-${i}`,
      speaker: typeof raw.speaker === 'string' ? raw.speaker.slice(0, 4) : 'A',
      text,
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '0:00',
      startMs: typeof raw.startMs === 'number' ? raw.startMs : 0,
      endMs: typeof raw.endMs === 'number' ? raw.endMs : 0,
    })
  }
  return { ok: true, lines: out }
}

async function runPipeline(
  sessionId: string,
  inputMode: InputMode,
  lines: TranscriptLine[],
  send: (e: Parameters<ReturnType<typeof createSSEStream>['send']>[0]) => void,
  signal: AbortSignal,
) {
  const persist = (partial: Parameters<typeof updateSession>[1]) => {
    updateSession(sessionId, partial).catch((err) => {
      console.warn('[pipeline] updateSession failed:', (err as Error).message)
    })
  }

  const setStage = (stage: PipelineStage) => {
    send({ type: 'stage', stage })
    persist({ stage })
  }

  setStage('input')
  for (const line of lines) send({ type: 'transcript_line', line })
  persist({ transcriptLines: lines, inputMode })

  if (signal.aborted) return

  setStage('transcribe')
  await new Promise((r) => setTimeout(r, 200))
  if (signal.aborted) return
  setStage('diarize')
  await new Promise((r) => setTimeout(r, 200))
  if (signal.aborted) return

  let model: ResilientLLM
  try {
    model = createResilientLLM()
  } catch (err) {
    send({ type: 'error', message: (err as Error).message })
    persist({ stage: 'error', error: (err as Error).message })
    return
  }

  const claims: ExtractedClaim[] = []
  const verdicts: Verdict[] = []
  const speakers: Speaker[] = []

  const onEvent = (event: GraphEvent) => {
    if (signal.aborted) return
    switch (event.type) {
      case 'stage':
        send({ type: 'stage', stage: event.stage })
        persist({ stage: event.stage })
        break
      case 'claim_detected':
        claims.push(event.claim)
        send({ type: 'claim_detected', claim: event.claim })
        persist({ claims })
        break
      case 'verifying':
        send({
          type: 'verifying',
          claimId: event.claimId,
          query: event.query,
          iteration: event.iteration,
        })
        break
      case 'verdict':
        verdicts.push(event.verdict)
        send({ type: 'verdict', verdict: event.verdict })
        persist({ verdicts })
        break
      case 'approval_required':
        send({
          type: 'approval_required',
          verdictId: event.verdictId,
          claimText: event.claimText,
          confidencePct: event.confidencePct,
        })
        break
      case 'speaker_update': {
        const idx = speakers.findIndex((s) => s.id === event.speaker.id)
        if (idx === -1) speakers.push(event.speaker)
        else speakers[idx] = event.speaker
        send({ type: 'speaker_update', speaker: event.speaker })
        persist({ speakers })
        break
      }
      case 'complete':
        send({ type: 'complete', sessionId })
        break
      case 'retrieval_warning':
        send({
          type: 'retrieval_warning',
          source: event.source,
          message: event.message,
        })
        break
      case 'error':
        // Per-claim failure surfaced from inside the graph. The graph keeps
        // running and emits a placeholder UNVERIFIED verdict for the claim,
        // so we log for observability but do NOT forward as a terminal SSE
        // error event (that would stop the UI mid-run).
        console.warn('[pipeline] graph error:', event.message)
        break
      default:
        break
    }
  }

  try {
    await runVeritasPipeline({
      transcriptLines: lines,
      inputMode,
      model,
      onEvent,
      signal,
    })
  } catch (err) {
    const message = (err as Error).message || 'Pipeline crashed'
    send({ type: 'error', message })
    persist({ stage: 'error', error: message })
  }
}

export async function POST(req: NextRequest) {
  const key = clientKey(req)
  // Pipeline hits 5 paid APIs per run, so it gets the strictest budget:
  // 3 runs per minute, 50 per day, per IP.
  const rl = await rateLimit(`pipeline:${key}`, [
    { max: 3, windowSeconds: 60, label: 'per-minute' },
    { max: 50, windowSeconds: 86_400, label: 'per-day' },
  ])
  if (!rl.allowed) {
    return new Response(
      JSON.stringify(rateLimitResponseBody(rl, 'pipeline')),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfterSeconds),
        },
      },
    )
  }

  let body: PipelineBody
  try {
    body = (await req.json()) as PipelineBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const validation = validateTranscriptLines(body.transcriptLines)
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const lines = validation.lines

  const inputMode: InputMode =
    body.inputMode === 'mic' || body.inputMode === 'file' || body.inputMode === 'text'
      ? body.inputMode
      : 'text'

  let sessionId = body.sessionId
  if (sessionId) {
    try {
      const existing = await getSession(sessionId)
      if (!existing) {
        const fresh = await createSession(inputMode)
        sessionId = fresh.id
      }
    } catch {
      const fresh = await createSession(inputMode)
      sessionId = fresh.id
    }
  } else {
    const fresh = await createSession(inputMode)
    sessionId = fresh.id
  }

  const { stream, send, close } = createSSEStream()

  const controller = new AbortController()
  req.signal.addEventListener('abort', () => controller.abort())

  const finalSessionId = sessionId!
  ;(async () => {
    try {
      await runPipeline(finalSessionId, inputMode, lines, send, controller.signal)
    } catch (err) {
      send({ type: 'error', message: (err as Error).message || 'Pipeline crashed' })
      try {
        await updateSession(finalSessionId, {
          stage: 'error',
          error: (err as Error).message,
        })
      } catch {
        /* ignore */
      }
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
