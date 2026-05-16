/**
 * Veritas evaluation harness. Reads eval/claims.jsonl, runs each claim end-to-end
 * through `runVeritasPipeline` against the real upstream APIs, and writes per-claim
 * results plus aggregate metrics (confusion matrix, per-label precision/recall/F1,
 * macro/weighted averages, mean iterations/evidence/latency, approval-required count).
 *
 * Usage: `pnpm eval` (requires GOOGLE_GENERATIVE_AI_API_KEY and TAVILY_API_KEY).
 *
 * The harness deliberately bypasses `/api/pipeline` so the rate limiter, SSE
 * plumbing, and session storage are not in the loop — what we are measuring
 * here is the graph + retrieval + LLM stack, not the HTTP layer.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createResilientLLM, type LLM } from '@/lib/agents/llm'
import { runVeritasPipeline, type GraphEvent } from '@/lib/agents/graph'
import type { TranscriptLine, Verdict, VerdictLabel } from '@/lib/types'

interface Claim {
  id: string
  claim: string
  expected: VerdictLabel
  category: string
  rationale: string
}

interface ClaimResult {
  id: string
  expected: VerdictLabel
  predicted: VerdictLabel
  confidencePct: number
  iterationsUsed: number
  evidenceCount: number
  approvalRequired: boolean
  latencyMs: number
}

const LABELS: VerdictLabel[] = ['VERIFIED', 'FALSE', 'MISLEADING', 'UNVERIFIED']

// Minimal .env.local loader — tsx does not auto-load env files like
// `next dev` does, and we want `pnpm eval` to Just Work when keys live in
// .env.local. Shell-exported env vars take precedence.
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf-8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
    if (!m) continue
    const key = m[1]
    let value = m[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function requireEnv(): void {
  const missing: string[] = []
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) missing.push('GOOGLE_GENERATIVE_AI_API_KEY')
  if (!process.env.TAVILY_API_KEY) missing.push('TAVILY_API_KEY')
  if (missing.length === 0) return
  console.error(
    `\nMissing required env var${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}\n` +
      `Configure them in .env.local (template at .env.example) and rerun \`pnpm eval\`.\n` +
      `The eval intentionally hits the real upstream APIs — there is no mock.\n`,
  )
  process.exit(1)
}

function readClaims(path: string): Claim[] {
  const text = readFileSync(path, 'utf-8')
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .map((line) => JSON.parse(line) as Claim)
}

async function evaluateOne(claim: Claim, model: LLM): Promise<ClaimResult> {
  const line: TranscriptLine = {
    id: claim.id,
    speaker: 'A',
    text: claim.claim,
    timestamp: '0:00',
    startMs: 0,
    endMs: 1000,
  }
  let finalVerdict: Verdict | null = null
  const onEvent = (e: GraphEvent): void => {
    if (e.type === 'verdict') finalVerdict = e.verdict
  }
  const t0 = Date.now()
  await runVeritasPipeline({
    transcriptLines: [line],
    inputMode: 'text',
    model,
    onEvent,
  })
  const latencyMs = Date.now() - t0
  if (!finalVerdict) {
    // No claim survived extraction — treat as UNVERIFIED for accounting.
    return {
      id: claim.id,
      expected: claim.expected,
      predicted: 'UNVERIFIED',
      confidencePct: 0,
      iterationsUsed: 0,
      evidenceCount: 0,
      approvalRequired: false,
      latencyMs,
    }
  }
  const v: Verdict = finalVerdict
  return {
    id: claim.id,
    expected: claim.expected,
    predicted: v.label,
    confidencePct: v.confidencePct,
    iterationsUsed: v.iterationsUsed,
    evidenceCount: v.evidence.length,
    approvalRequired: v.approvalRequired,
    latencyMs,
  }
}

type ConfusionMatrix = Record<VerdictLabel, Record<VerdictLabel, number>>
type LabelMetrics = Record<
  VerdictLabel,
  { precision: number; recall: number; f1: number; support: number }
>

function buildConfusion(results: ClaimResult[]): ConfusionMatrix {
  const matrix = Object.fromEntries(
    LABELS.map((e) => [e, Object.fromEntries(LABELS.map((p) => [p, 0]))]),
  ) as ConfusionMatrix
  for (const r of results) matrix[r.expected][r.predicted] += 1
  return matrix
}

function buildMetrics(results: ClaimResult[]): LabelMetrics {
  const out = {} as LabelMetrics
  for (const label of LABELS) {
    const tp = results.filter((r) => r.predicted === label && r.expected === label).length
    const fp = results.filter((r) => r.predicted === label && r.expected !== label).length
    const fn = results.filter((r) => r.predicted !== label && r.expected === label).length
    const support = results.filter((r) => r.expected === label).length
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    out[label] = { precision, recall, f1, support }
  }
  return out
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : ' '.repeat(w - s.length) + s
}

function printReport(results: ClaimResult[]): void {
  const total = results.length
  const confusion = buildConfusion(results)
  const metrics = buildMetrics(results)

  console.log('\n=== Confusion matrix (rows = expected, cols = predicted) ===\n')
  console.log(['', ...LABELS].map((s) => pad(s, 13)).join(' '))
  for (const e of LABELS) {
    console.log(
      [e, ...LABELS.map((p) => String(confusion[e][p]))].map((s) => pad(s, 13)).join(' '),
    )
  }

  console.log('\n=== Per-label metrics ===\n')
  console.log(['Label', 'P', 'R', 'F1', 'N'].map((s) => pad(s, 13)).join(' '))
  let macroP = 0
  let macroR = 0
  let macroF = 0
  let weightedP = 0
  let weightedR = 0
  let weightedF = 0
  for (const label of LABELS) {
    const m = metrics[label]
    console.log(
      [label, m.precision.toFixed(3), m.recall.toFixed(3), m.f1.toFixed(3), String(m.support)]
        .map((s) => pad(s, 13))
        .join(' '),
    )
    macroP += m.precision
    macroR += m.recall
    macroF += m.f1
    weightedP += m.precision * m.support
    weightedR += m.recall * m.support
    weightedF += m.f1 * m.support
  }
  macroP /= LABELS.length
  macroR /= LABELS.length
  macroF /= LABELS.length
  weightedP /= total
  weightedR /= total
  weightedF /= total
  console.log('-'.repeat(72))
  console.log(
    ['Macro', macroP.toFixed(3), macroR.toFixed(3), macroF.toFixed(3), String(total)]
      .map((s) => pad(s, 13))
      .join(' '),
  )
  console.log(
    ['Weighted', weightedP.toFixed(3), weightedR.toFixed(3), weightedF.toFixed(3), String(total)]
      .map((s) => pad(s, 13))
      .join(' '),
  )

  const meanIter = results.reduce((s, r) => s + r.iterationsUsed, 0) / total
  const meanEvi = results.reduce((s, r) => s + r.evidenceCount, 0) / total
  const meanLat = results.reduce((s, r) => s + r.latencyMs, 0) / total
  const approvalCount = results.filter((r) => r.approvalRequired).length

  console.log('\n=== Aggregate ===\n')
  console.log(`Mean iterations per claim   : ${meanIter.toFixed(2)}`)
  console.log(`Mean evidence docs per claim: ${meanEvi.toFixed(2)}`)
  console.log(`Mean latency per claim      : ${meanLat.toFixed(0)} ms`)
  console.log(`Approval-required verdicts  : ${approvalCount} / ${total}`)
  console.log()
}

async function main(): Promise<void> {
  loadEnvFile(resolve(process.cwd(), '.env.local'))
  requireEnv()
  const claimsPath = resolve(process.cwd(), 'eval/claims.jsonl')
  const resultsPath = resolve(process.cwd(), 'eval/results.json')
  const claims = readClaims(claimsPath)
  console.log(`Loaded ${claims.length} claims from ${claimsPath}.`)

  const model = createResilientLLM()
  const results: ClaimResult[] = []
  for (let i = 0; i < claims.length; i++) {
    const c = claims[i]
    process.stdout.write(
      `[${String(i + 1).padStart(2, '0')}/${claims.length}] ${c.id} (expected ${c.expected})... `,
    )
    try {
      const r = await evaluateOne(c, model)
      results.push(r)
      const ok = r.predicted === r.expected ? 'OK  ' : 'MISS'
      console.log(
        `${ok} predicted=${r.predicted} conf=${r.confidencePct}% iter=${r.iterationsUsed} ev=${r.evidenceCount} lat=${r.latencyMs}ms`,
      )
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`)
      results.push({
        id: c.id,
        expected: c.expected,
        predicted: 'UNVERIFIED',
        confidencePct: 0,
        iterationsUsed: 0,
        evidenceCount: 0,
        approvalRequired: false,
        latencyMs: 0,
      })
    }
  }

  writeFileSync(
    resultsPath,
    JSON.stringify({ runAt: new Date().toISOString(), claims: results }, null, 2),
  )
  console.log(`\nPer-claim results written to ${resultsPath}.`)
  printReport(results)
}

void main()
