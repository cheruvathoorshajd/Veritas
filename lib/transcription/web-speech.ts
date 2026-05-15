import type { TranscriptLine } from '@/lib/types'

export interface WebSpeechResult {
  transcript: string
  isFinal: boolean
  confidence: number
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString(10).padStart(2, '0')}`
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function chunkToTranscriptLine(
  text: string,
  speaker: string,
  startMs: number,
): TranscriptLine {
  const trimmed = text.trim()
  // rough 150wpm estimate for endMs
  const wpm = 150
  const words = Math.max(1, trimmed.split(/\s+/).length)
  const durationMs = Math.round((words / wpm) * 60_000)
  return {
    id: randomId(),
    speaker,
    text: trimmed,
    timestamp: formatTimestamp(startMs),
    startMs,
    endMs: startMs + durationMs,
  }
}

// Detect "Speaker A:" / "A:" style speaker prefixes
export function parseTranscriptFromText(input: string): TranscriptLine[] {
  if (!input.trim()) return []
  const lines = input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const speakerRegex = /^(?:Speaker\s+)?([A-Z])\s*[:\-]\s*(.*)$/i
  const out: TranscriptLine[] = []
  let currentSpeaker = 'A'
  let cursorMs = 0

  let detectedAny = false
  for (const line of lines) {
    const match = line.match(speakerRegex)
    if (match) {
      detectedAny = true
      currentSpeaker = match[1].toUpperCase()
      const body = match[2].trim()
      if (body) {
        out.push(chunkToTranscriptLine(body, currentSpeaker, cursorMs))
        const words = Math.max(1, body.split(/\s+/).length)
        cursorMs += Math.round((words / 150) * 60_000) + 1000
      }
    } else {
      out.push(chunkToTranscriptLine(line, currentSpeaker, cursorMs))
      const words = Math.max(1, line.split(/\s+/).length)
      cursorMs += Math.round((words / 150) * 60_000) + 1000
    }
  }

  if (!detectedAny) {
    // Whole input as a single speaker A line (broken by sentences)
    const sentences = input.match(/[^.!?]+[.!?]+/g) ?? [input.trim()]
    const result: TranscriptLine[] = []
    let t = 0
    for (const s of sentences) {
      const trimmed = s.trim()
      if (!trimmed) continue
      result.push(chunkToTranscriptLine(trimmed, 'A', t))
      const words = Math.max(1, trimmed.split(/\s+/).length)
      t += Math.round((words / 150) * 60_000) + 500
    }
    return result
  }

  return out
}
