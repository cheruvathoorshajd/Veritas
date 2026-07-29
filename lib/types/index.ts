export type InputMode = 'mic' | 'file' | 'text'

export type VerdictLabel =
  | 'VERIFIED'
  | 'FALSE'
  | 'MISLEADING'
  | 'UNVERIFIED'
  | 'CONTESTED'

export type ClaimType =
  | 'statistical'
  | 'causal'
  | 'historical'
  | 'predictive'
  | 'normative'
  | 'scientific_consensus'
  | 'political_position'

export type RhetoricalPattern =
  | 'appeal_to_authority'
  | 'false_dichotomy'
  | 'slippery_slope'
  | 'ad_hominem'
  | 'straw_man'
  | 'appeal_to_fear'
  | 'cherry_picking'
  | 'gish_gallop'
  | 'moving_goalposts'
  | 'appeal_to_nature'
  | 'bandwagon'

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
  claimsContested?: number
  accuracyPct: number
  /** Cross-session credibility score from `lib/credibility/score.ts`. */
  credibilityScore?: number | null
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
  /** Coarse semantic category — drives the confidence-decay half-life table. */
  claimType?: ClaimType
  /** Named entities extracted alongside the claim — drives the genealogy graph. */
  entities?: string[]
  /** Model's self-rated confidence the claim is verifiable, 0–1. */
  extractionConfidence?: number
  /** When this claim was merged with another due to high token overlap. */
  mergedFromIds?: string[]
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
  /** Evidence gathered specifically during the adversarial pass (Phase 4E). */
  counterEvidence?: Evidence[]
  searchQueries: string[]
  iterationsUsed: number
  approvalRequired: boolean
  approved: boolean | null
  /** Detected rhetorical pattern (Phase 4B). */
  rhetoricalPattern?: RhetoricalPattern | null
  /** ISO timestamp when the verdict was produced — used by confidence decay. */
  producedAt?: string
  /** Cached claim category propagated from the claim. */
  claimType?: ClaimType
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
  /**
   * Per-session bearer token issued at create time. Only the holder of
   * this token can mutate the session (verdict approvals). Returned once
   * in the create response — never re-emitted.
   *
   * Server only — clients should never read this off a fetched Session.
   * The API surface only includes it on the POST /api/session response.
   */
  approvalToken?: string
}

export interface SearchResult {
  title: string
  url: string
  content: string
  score: number
}

export type RetrievalSource = 'tavily' | 'wikipedia' | 'politifact'

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
  | { type: 'retrieval_warning'; source: RetrievalSource; message: string }

// ─── Phase 4A: Claim Genealogy ────────────────────────────────────────────────

export interface GenealogyNode {
  id: string
  label: string
  verdict: VerdictLabel
  speaker: string
  entities: string[]
}

export interface GenealogyEdge {
  from: string
  to: string
  weight: number
  sharedEntities: string[]
}

export interface GenealogyGraph {
  nodes: GenealogyNode[]
  edges: GenealogyEdge[]
}

// ─── Phase 4C: Confidence Decay ───────────────────────────────────────────────

export interface FreshnessInfo {
  freshness: number // 0..1
  isStale: boolean
  daysElapsed: number
  halfLifeDays: number | null // null = never decays
}
