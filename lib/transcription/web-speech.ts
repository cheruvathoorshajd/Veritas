import type { TranscriptLine } from '@/lib/types'

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

// Sentinel char (U+0001) substituted for "."s that are part of abbreviations,
// initials, or decimals so the sentence splitter doesn't break on them.
const SENT_DOT = String.fromCharCode(1)
const ABBREVIATIONS =
  /\b(?:Mr|Mrs|Ms|Mx|Dr|Prof|Rev|Fr|Sr|Jr|St|Hon|Gen|Col|Sgt|Lt|Capt|Cmdr|Inc|Ltd|Co|Corp|Bros|Assn|Dept|Univ|No|Vol|pp|p|vs|etc|al|e\.g|i\.e|U\.S|U\.K|U\.N|E\.U|a\.m|p\.m|A\.M|P\.M)\./g

export function splitSentencesPreservingAbbreviations(text: string): string[] {
  const protectedText = text
    .replace(ABBREVIATIONS, (m) => m.slice(0, -1) + SENT_DOT)
    .replace(/\b([A-Z])\.(?=\s+[A-Z])/g, (_m, c) => `${c}${SENT_DOT}`)
    .replace(/(\d)\.(\d)/g, (_m, a, b) => `${a}${SENT_DOT}${b}`)

  const matches =
    protectedText.match(/[^.!?]+[.!?]+(?:["')\]]+)?/g) ?? [protectedText]
  return matches
    .map((s) => s.split(SENT_DOT).join('.').trim())
    .filter(Boolean)
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
        for (const sentence of splitSentencesPreservingAbbreviations(body)) {
          out.push(chunkToTranscriptLine(sentence, currentSpeaker, cursorMs))
          const w = Math.max(1, sentence.split(/\s+/).length)
          cursorMs += Math.round((w / 150) * 60_000) + 500
        }
      }
    } else {
      for (const sentence of splitSentencesPreservingAbbreviations(line)) {
        out.push(chunkToTranscriptLine(sentence, currentSpeaker, cursorMs))
        const w = Math.max(1, sentence.split(/\s+/).length)
        cursorMs += Math.round((w / 150) * 60_000) + 500
      }
    }
  }

  if (!detectedAny) {
    const sentences = splitSentencesPreservingAbbreviations(input)
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
