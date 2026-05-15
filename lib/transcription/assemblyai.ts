import { AssemblyAI } from 'assemblyai'
import type { TranscriptLine } from '@/lib/types'
import { formatTimestamp } from './web-speech'

const SUPPORTED_EXTENSIONS = new Set([
  'mp3',
  'mp4',
  'wav',
  'm4a',
  'webm',
  'ogg',
  'flac',
])

const MAX_BYTES = 100 * 1024 * 1024

export class TranscriptionError extends Error {
  constructor(message: string, public status?: number, public cause?: unknown) {
    super(message)
    this.name = 'TranscriptionError'
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function getClient(): AssemblyAI {
  const key = process.env.ASSEMBLYAI_API_KEY
  if (!key) {
    throw new TranscriptionError('ASSEMBLYAI_API_KEY is not set', 500)
  }
  return new AssemblyAI({ apiKey: key })
}

function assertValidFile(fileName: string, size: number): void {
  if (size > MAX_BYTES) {
    throw new TranscriptionError('File exceeds 100MB limit', 413)
  }
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new TranscriptionError(
      `Unsupported format .${ext}. Allowed: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`,
      422,
    )
  }
}

// AssemblyAI emits speaker strings like "A"/"B"/"1"/"2". Normalise to "A","B","C"...
function normaliseSpeaker(raw: string | null | undefined, map: Map<string, string>): string {
  const key = (raw ?? 'A').toString()
  const existing = map.get(key)
  if (existing) return existing
  const idx = map.size
  const letter = String.fromCharCode(65 + (idx % 26))
  map.set(key, letter)
  return letter
}

export async function transcribeFile(
  audioBuffer: Buffer,
  fileName: string,
): Promise<TranscriptLine[]> {
  assertValidFile(fileName, audioBuffer.length)
  const client = getClient()

  let uploadUrl: string
  try {
    uploadUrl = await client.files.upload(audioBuffer)
  } catch (err) {
    throw new TranscriptionError('AssemblyAI upload failed', 502, err)
  }

  let transcriptId: string
  try {
    const transcript = await client.transcripts.submit({
      audio: uploadUrl,
      speaker_labels: true,
    })
    transcriptId = transcript.id
  } catch (err) {
    throw new TranscriptionError('Failed to submit transcript job', 502, err)
  }

  // Poll with 2s backoff up to ~5 minutes
  const maxAttempts = 150
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let current
    try {
      current = await client.transcripts.get(transcriptId)
    } catch (err) {
      throw new TranscriptionError('Failed to poll transcript', 502, err)
    }
    if (current.status === 'completed') {
      const speakerMap = new Map<string, string>()
      const utterances = current.utterances ?? []
      const lines: TranscriptLine[] = utterances.map((u) => {
        const speaker = normaliseSpeaker(u.speaker, speakerMap)
        const startMs = u.start ?? 0
        const endMs = u.end ?? startMs
        return {
          id: randomId(),
          speaker,
          text: (u.text ?? '').trim(),
          timestamp: formatTimestamp(startMs),
          startMs,
          endMs,
        }
      })
      if (lines.length === 0 && current.text) {
        lines.push({
          id: randomId(),
          speaker: 'A',
          text: current.text.trim(),
          timestamp: '0:00',
          startMs: 0,
          endMs: current.audio_duration ? current.audio_duration * 1000 : 0,
        })
      }
      return lines.sort((a, b) => a.startMs - b.startMs)
    }
    if (current.status === 'error') {
      throw new TranscriptionError(
        current.error || 'AssemblyAI transcription failed',
        500,
      )
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  throw new TranscriptionError('AssemblyAI polling timed out', 504)
}
