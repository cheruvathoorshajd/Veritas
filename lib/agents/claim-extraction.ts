import { traceable } from 'langsmith/traceable'
import type { LLM } from '@/lib/agents/llm'
import type { ExtractedClaim, TranscriptLine } from '@/lib/types'
import { isLikelyCheckworthy } from '@/lib/nlp/claim-detector'

const SYSTEM_PROMPT = `You are a claim extraction specialist. Your job is to identify every verifiable factual claim in the provided transcript. A claim is checkworthy if it:
- States a specific statistic, percentage, or number
- Makes a causal assertion ("X caused Y")
- States a historical fact or event
- Claims something happened, exists, or is true
- Attributes beliefs/actions to real organisations or people

NOT checkworthy:
- Opinions ("I think...", "I believe...")
- Rhetorical questions
- Vague statements without specifics ("things are bad")
- Future predictions

For each claim return JSON:
{
  "claimText": "exact claim, condensed to its core assertion",
  "originalText": "full sentence it came from",
  "speaker": "A/B/C/...",
  "timestamp": "M:SS",
  "searchQuery": "3-8 word web search query to verify this claim",
  "isCheckworthy": true
}

Return a JSON array. No markdown. No preamble.`

function uuid(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === 'string') return p
        if (p && typeof p === 'object' && 'text' in p && typeof (p as { text?: string }).text === 'string') {
          return (p as { text: string }).text
        }
        return ''
      })
      .join('\n')
  }
  return ''
}

function stripFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return s.trim()
}

interface RawClaim {
  claimText?: string
  originalText?: string
  speaker?: string
  timestamp?: string
  searchQuery?: string
  isCheckworthy?: boolean | string
}

function transcriptToText(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${l.speaker}] (${l.timestamp}) ${l.text}`)
    .join('\n')
}

async function extractClaimsImpl(
  lines: TranscriptLine[],
  model: LLM,
): Promise<ExtractedClaim[]> {
  if (!lines.length) return []
  // Pre-filter with the cheap heuristic in `isLikelyCheckworthy` so the Gemini
  // prompt only contains plausibly checkworthy lines; opinions, future tense
  // and one-word interjections drop out before we burn an LLM call. The
  // original `lines` list is preserved on the side so downstream speaker/
  // timestamp attribution on the verdict is unaffected.
  const filteredLines = lines.filter((l) => isLikelyCheckworthy(l.text))
  if (!filteredLines.length) return []
  const transcript = transcriptToText(filteredLines)
  const prompt = `${SYSTEM_PROMPT}\n\nTranscript:\n${transcript}`

  let response
  try {
    response = await model.invoke(prompt)
  } catch (err) {
    console.warn('[claim-extraction] model invocation failed:', (err as Error).message)
    return []
  }

  const raw = stripFence(messageText(response.content))
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) {
      console.warn('[claim-extraction] could not parse JSON from model output')
      return []
    }
    try {
      parsed = JSON.parse(match[0])
    } catch {
      return []
    }
  }

  if (!Array.isArray(parsed)) return []

  const claims: ExtractedClaim[] = []
  for (const item of parsed as RawClaim[]) {
    const text = (item.claimText ?? '').trim()
    if (!text) continue
    const raw = item.isCheckworthy
    const isFalse = raw === false || String(raw).toLowerCase() === 'false'
    if (isFalse) continue
    claims.push({
      id: uuid(),
      speaker: (item.speaker ?? 'A').toString().toUpperCase().slice(0, 1) || 'A',
      timestamp: item.timestamp ?? '0:00',
      originalText: (item.originalText ?? text).trim(),
      claimText: text,
      searchQuery: (item.searchQuery ?? text).trim(),
      isCheckworthy: true,
    })
  }
  return claims
}

export const extractClaims = traceable(extractClaimsImpl, {
  name: 'veritas:claim-extraction',
  project_name: 'veritas',
})
