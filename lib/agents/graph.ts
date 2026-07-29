import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import type { LLM } from './llm'
import type {
  Evidence,
  ExtractedClaim,
  InputMode,
  PipelineStage,
  RetrievalSource,
  Speaker,
  TranscriptLine,
  Verdict,
} from '@/lib/types'
import { extractClaims } from './claim-extraction'
import { runReActVerification } from './verification'
import { synthesiseVerdict } from './verdict'
import { generateReport } from './report'
import { uuid } from '@/lib/utils/id'

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
  | { type: 'error'; message: string }
  | { type: 'retrieval_warning'; source: RetrievalSource; message: string }

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
  try {
    const newClaims = await extractClaims(state.transcriptLines, state.model)
    for (const c of newClaims) state.onEvent({ type: 'claim_detected', claim: c })
    return { claims: newClaims, currentClaimIndex: 0, stage: 'extract' as PipelineStage }
  } catch (err) {
    state.onEvent({ type: 'error', message: `extract_failed: ${(err as Error).message}` })
    // claims: [] routes via routeAfterExtract → generate_report, so the run
    // ends cleanly instead of crashing the whole graph.
    return { claims: [], stage: 'verify' as PipelineStage }
  }
}

async function verifyNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  state.onEvent({ type: 'stage', stage: 'verify' })
  try {
    const claim = state.claims[state.currentClaimIndex]
    if (!claim) {
      // Routing guarantees a claim exists here; if it ever doesn't, the
      // safe fallback (returning empty deltas) would loop forever because
      // currentClaimIndex never advances. Fail loudly instead — the outer
      // try/catch turns this into a per-claim error, not a pipeline crash.
      throw new Error(
        `verifyNode invoked with no claim at index ${state.currentClaimIndex}`,
      )
    }
    const { evidence, queries, iterations } = await runReActVerification(
      claim,
      state.model,
      3,
      {
        onIteration: (query, iteration) =>
          state.onEvent({ type: 'verifying', claimId: claim.id, query, iteration }),
        onRetrievalIssue: (source, message) =>
          state.onEvent({ type: 'retrieval_warning', source, message }),
      },
    )
    return {
      searchResults: evidence,
      iterationCount: iterations,
      currentClaimQueries: queries,
      stage: 'verify' as PipelineStage,
    }
  } catch (err) {
    state.onEvent({ type: 'error', message: `verify_failed: ${(err as Error).message}` })
    // Reset per-claim state so verdictNode hits the empty-evidence
    // short-circuit and emits an UNVERIFIED verdict (~10% confidence).
    return {
      searchResults: [],
      iterationCount: 0,
      currentClaimQueries: [],
      stage: 'verify' as PipelineStage,
    }
  }
}

async function verdictNode(state: VeritasStateType): Promise<Partial<VeritasStateType>> {
  state.onEvent({ type: 'stage', stage: 'verdict' })
  const claim = state.claims[state.currentClaimIndex]
  if (!claim) return { stage: 'verdict' as PipelineStage }
  try {
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
  } catch (err) {
    state.onEvent({ type: 'error', message: `verdict_failed: ${(err as Error).message}` })
    // Synthesise a placeholder UNVERIFIED verdict so the claim still appears
    // in the UI with the original attribution. approvalRequired forces it
    // into the human-review band rather than silently dropping the claim.
    const synthetic: Verdict = {
      id: uuid(),
      claimId: claim.id,
      speaker: claim.speaker,
      timestamp: claim.timestamp,
      claimText: claim.claimText,
      label: 'UNVERIFIED',
      confidencePct: 0,
      explanation: 'Verdict synthesis failed; treating as unverified.',
      evidence: [],
      searchQueries: state.currentClaimQueries,
      iterationsUsed: state.iterationCount,
      approvalRequired: true,
      approved: null,
    }
    state.onEvent({ type: 'verdict', verdict: synthetic })
    state.onEvent({
      type: 'approval_required',
      verdictId: synthetic.id,
      claimText: synthetic.claimText,
      confidencePct: synthetic.confidencePct,
    })
    return { verdicts: [synthetic], stage: 'verdict' as PipelineStage }
  }
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
  signal?: AbortSignal
}

export async function runVeritasPipeline(options: RunVeritasOptions): Promise<void> {
  const initial: Partial<VeritasStateType> = {
    transcriptLines: options.transcriptLines,
    inputMode: options.inputMode,
    model: options.model,
    onEvent: options.onEvent,
  }
  // PregelOptions extends RunnableConfig which carries `signal`; LangGraph
  // propagates it through tool/LLM calls so retrieval and Gemini invocations
  // honour the abort. The chunk-level check below catches runtimes where the
  // signal isn't honoured natively — we still stop draining at the next
  // node boundary.
  const stream = await veritasGraph.stream(
    initial,
    options.signal ? { signal: options.signal } : undefined,
  )
  for await (const _chunk of stream) {
    void _chunk
    if (options.signal?.aborted) break
  }
}
