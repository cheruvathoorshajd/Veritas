import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import type { LLM } from './llm'
import type {
  Evidence,
  ExtractedClaim,
  InputMode,
  PipelineStage,
  Speaker,
  TranscriptLine,
  Verdict,
} from '@/lib/types'
import { extractClaims } from './claim-extraction'
import { runReActVerification } from './verification'
import { synthesiseVerdict } from './verdict'
import { generateReport } from './report'

export type GraphEvent =
  | { type: 'stage'; stage: PipelineStage }
  | { type: 'claim_detected'; claim: ExtractedClaim }
  | { type: 'verifying'; claimId: string; query: string; iteration: number }
  | { type: 'verdict'; verdict: Verdict }
  | {
      type: 'approval_required'
      verdictId: string
      claimText: string
      confidencePct: number
    }
  | { type: 'speaker_update'; speaker: Speaker }
  | { type: 'complete' }

export type GraphEventEmitter = (event: GraphEvent) => void

const noopModel: LLM = {
  async invoke() {
    throw new Error('LLM model was not supplied to the Veritas pipeline graph')
  },
}

const noopEmitter: GraphEventEmitter = () => {}

export const VeritasState = Annotation.Root({
  transcriptLines: Annotation<TranscriptLine[]>({ reducer: (_a, b) => b, default: () => [] }),
  inputMode: Annotation<InputMode>({ reducer: (_a, b) => b, default: () => 'text' }),

  // The single ResilientLLM instance for this run is threaded through state.
  // Replace reducer: the initial invocation supplies it; nodes never overwrite it.
  model: Annotation<LLM>({ reducer: (_a, b) => b, default: () => noopModel }),
  onEvent: Annotation<GraphEventEmitter>({ reducer: (_a, b) => b, default: () => noopEmitter }),

  claims: Annotation<ExtractedClaim[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  currentClaimIndex: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),

  searchResults: Annotation<Evidence[]>({ reducer: (_a, b) => b, default: () => [] }),
  iterationCount: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  // Replace semantics so verdictNode reads only the queries for the current claim.
  currentClaimQueries: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),

  verdicts: Annotation<Verdict[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  speakers: Annotation<Speaker[]>({ reducer: (_a, b) => b, default: () => [] }),

  stage: Annotation<PipelineStage>({ reducer: (_a, b) => b, default: () => 'idle' }),
  error: Annotation<string | null>({ reducer: (_a, b) => b, default: () => null }),
})

export type VeritasStateType = typeof VeritasState.State

async function extractNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  state.onEvent({ type: 'stage', stage: 'extract' })
  const newClaims = await extractClaims(state.transcriptLines, state.model)
  for (const c of newClaims) state.onEvent({ type: 'claim_detected', claim: c })
  return { claims: newClaims, currentClaimIndex: 0, stage: 'extract' as PipelineStage }
}

async function verifyNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  state.onEvent({ type: 'stage', stage: 'verify' })
  const claim = state.claims[state.currentClaimIndex]
  if (!claim) {
    return {
      searchResults: [],
      iterationCount: 0,
      currentClaimQueries: [],
      stage: 'verify' as PipelineStage,
    }
  }
  const { evidence, queries, iterations } = await runReActVerification(
    claim,
    state.model,
    3,
    {
      onIteration: (query, iteration) =>
        state.onEvent({ type: 'verifying', claimId: claim.id, query, iteration }),
    },
  )
  return {
    searchResults: evidence,
    iterationCount: iterations,
    currentClaimQueries: queries,
    stage: 'verify' as PipelineStage,
  }
}

async function verdictNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  state.onEvent({ type: 'stage', stage: 'verdict' })
  const claim = state.claims[state.currentClaimIndex]
  if (!claim) return { stage: 'verdict' as PipelineStage }
  const verdict = await synthesiseVerdict(
    claim,
    state.searchResults,
    state.model,
    state.currentClaimQueries,
    state.iterationCount,
  )
  state.onEvent({ type: 'verdict', verdict })
  if (verdict.approvalRequired) {
    state.onEvent({
      type: 'approval_required',
      verdictId: verdict.id,
      claimText: verdict.claimText,
      confidencePct: verdict.confidencePct,
    })
  }
  return { verdicts: [verdict], stage: 'verdict' as PipelineStage }
}

async function nextClaimNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  return {
    currentClaimIndex: state.currentClaimIndex + 1,
    searchResults: [],
    iterationCount: 0,
    currentClaimQueries: [],
  }
}

async function reportNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  const speakers = await generateReport(state.verdicts, state.transcriptLines)
  for (const s of speakers) state.onEvent({ type: 'speaker_update', speaker: s })
  state.onEvent({ type: 'stage', stage: 'complete' })
  state.onEvent({ type: 'complete' })
  return { speakers, stage: 'complete' as PipelineStage }
}

function routeAfterExtract(state: VeritasStateType): 'verify_claim' | 'generate_report' {
  return state.claims.length > 0 ? 'verify_claim' : 'generate_report'
}

function routeAfterNext(state: VeritasStateType): 'verify_claim' | 'generate_report' {
  return state.currentClaimIndex < state.claims.length ? 'verify_claim' : 'generate_report'
}

const graph = new StateGraph(VeritasState)
  .addNode('extract_claims', extractNode)
  .addNode('verify_claim', verifyNode)
  .addNode('synthesise_verdict', verdictNode)
  .addNode('next_claim', nextClaimNode)
  .addNode('generate_report', reportNode)
  .addEdge(START, 'extract_claims')
  .addConditionalEdges('extract_claims', routeAfterExtract, {
    verify_claim: 'verify_claim',
    generate_report: 'generate_report',
  })
  .addEdge('verify_claim', 'synthesise_verdict')
  .addEdge('synthesise_verdict', 'next_claim')
  .addConditionalEdges('next_claim', routeAfterNext, {
    verify_claim: 'verify_claim',
    generate_report: 'generate_report',
  })
  .addEdge('generate_report', END)

export const veritasGraph = graph.compile()

export interface RunVeritasOptions {
  transcriptLines: TranscriptLine[]
  inputMode: InputMode
  model: LLM
  onEvent: GraphEventEmitter
}

export async function runVeritasPipeline(options: RunVeritasOptions): Promise<void> {
  const initial: Partial<VeritasStateType> = {
    transcriptLines: options.transcriptLines,
    inputMode: options.inputMode,
    model: options.model,
    onEvent: options.onEvent,
  }
  const stream = await veritasGraph.stream(initial)
  // Drain the stream. Granular events are emitted from inside the nodes via
  // `state.onEvent`; the per-node state deltas yielded here are not needed.
  for await (const _chunk of stream) {
    void _chunk
  }
}
