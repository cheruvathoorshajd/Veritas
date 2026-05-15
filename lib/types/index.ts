export type InputMode = 'mic' | 'file' | 'text'

export type VerdictLabel = 'VERIFIED' | 'FALSE' | 'MISLEADING' | 'UNVERIFIED'

export type PipelineStage =
  | 'idle'
  | 'input'
  | 'transcribe'
  | 'diarize'
  | 'extract'
  | 'verify'
  | 'verdict'
  | 'complete'
  | 'error'

export interface Speaker {
  id: string
  label: string
  claimsTotal: number
  claimsVerified: number
  claimsFalse: number
  claimsMisleading: number
  claimsUnverified: number
  accuracyPct: number
}

export interface TranscriptLine {
  id: string
  speaker: string
  text: string
  timestamp: string
  startMs: number
  endMs: number
}

export interface ExtractedClaim {
  id: string
  speaker: string
  timestamp: string
  originalText: string
  claimText: string
  searchQuery: string
  isCheckworthy: boolean
}

export interface Evidence {
  source: string
  url: string
  excerpt: string
  stance: 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL'
  credibilityScore: number
}

export interface Verdict {
  id: string
  claimId: string
  speaker: string
  timestamp: string
  claimText: string
  label: VerdictLabel
  confidencePct: number
  explanation: string
  evidence: Evidence[]
  searchQueries: string[]
  iterationsUsed: number
  approvalRequired: boolean
  approved: boolean | null
}

export interface Session {
  id: string
  createdAt: string
  inputMode: InputMode
  transcriptLines: TranscriptLine[]
  claims: ExtractedClaim[]
  verdicts: Verdict[]
  speakers: Speaker[]
  stage: PipelineStage
  error: string | null
}

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

export type StreamEvent =
  | { type: 'stage'; stage: PipelineStage }
  | { type: 'transcript_line'; line: TranscriptLine }
  | { type: 'claim_detected'; claim: ExtractedClaim }
  | { type: 'verifying'; claimId: string; query: string; iteration: number }
  | { type: 'verdict'; verdict: Verdict }
  | { type: 'speaker_update'; speaker: Speaker }
  | { type: 'complete'; sessionId: string }
  | { type: 'error'; message: string }
  | { type: 'approval_required'; verdictId: string; claimText: string; confidencePct: number }
