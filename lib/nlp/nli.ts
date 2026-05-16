import type { LLM } from '@/lib/agents/llm'
import { domainCredibility } from './credibility'
import { extractJsonObject } from '@/lib/utils/json'

export type NliStance = 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL'

export interface NliResult {
  stance: NliStance
  credibilityScore: number
  rationale: string
}

const PROMPT_WITH_CREDIBILITY = `You are a natural language inference engine.

Given a CLAIM and EVIDENCE, classify the relationship:
- SUPPORTS: the evidence directly confirms the claim
- CONTRADICTS: the evidence directly refutes the claim
- NEUTRAL: evidence is unrelated or insufficient

Also return a credibility score (0-100) for the evidence source:
- 90-100 for primary government / academic sources (BLS, Fed, IPCC, peer-reviewed journals)
- 70-89 for major reputable news outlets and fact-checking orgs
- 50-69 for general news / opinion-mixed sources
- 0-49 for low-quality or unknown sources

Return JSON exactly:
{ "stance": "SUPPORTS|CONTRADICTS|NEUTRAL", "credibilityScore": <0-100>, "rationale": "<one sentence>" }
No markdown, no preamble.`

const PROMPT_STANCE_ONLY = `You are a natural language inference engine.

Given a CLAIM and EVIDENCE, classify the relationship:
- SUPPORTS: the evidence directly confirms the claim
- CONTRADICTS: the evidence directly refutes the claim
- NEUTRAL: evidence is unrelated or insufficient

Return JSON exactly:
{ "stance": "SUPPORTS|CONTRADICTS|NEUTRAL", "rationale": "<one sentence>" }
No markdown, no preamble.`

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p && typeof p === 'object' && 'text' in p ? (p as { text?: string }).text ?? '' : ''))
      .join('\n')
  }
  return ''
}

// Negation words that, when appearing within 5 tokens BEFORE a matched claim
// token, flip its contribution from supporting to contradicting. Trailing
// space removed because we now compare tokens, not substrings.
const NEGATION_TOKENS = new Set([
  'not',
  'no',
  'never',
  'none',
  'contradict',
  'contradicts',
  'contradicted',
  'false',
  'incorrect',
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "don't",
  "doesn't",
  "didn't",
])

function heuristic(claim: string, evidence: string): NliResult {
  const c = claim.toLowerCase()
  const e = evidence.toLowerCase()
  let stance: NliStance = 'NEUTRAL'
  if (e.length > 0) {
    const claimTokens = c.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 3)
    // Tokenise the evidence the same way and check with set membership so
    // claim token "rate" no longer matches "frustrate" via substring search.
    const evTokenList = e.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
    const evTokenSet = new Set(evTokenList)
    const claimTokenSet = new Set(claimTokens)
    const overlap = claimTokens.filter((t) => evTokenSet.has(t)).length
    if (overlap >= Math.max(2, Math.floor(claimTokens.length / 3))) {
      // Negation is scoped: for each evidence token that matches a claim token,
      // look back at the 5 preceding tokens. Each preceding negation counts as
      // one contradiction signal. Only flip to CONTRADICTS if contradiction
      // signals outnumber plain (non-negated) overlap matches.
      let contradictionSignals = 0
      let plainOverlaps = 0
      for (let i = 0; i < evTokenList.length; i++) {
        const tok = evTokenList[i]
        if (!claimTokenSet.has(tok)) continue
        const window = evTokenList.slice(Math.max(0, i - 5), i)
        if (window.some((w) => NEGATION_TOKENS.has(w))) {
          contradictionSignals += 1
        } else {
          plainOverlaps += 1
        }
      }
      stance = contradictionSignals > plainOverlaps ? 'CONTRADICTS' : 'SUPPORTS'
    }
  }
  return { stance, credibilityScore: 55, rationale: 'Heuristic classification (LLM unavailable).' }
}

export async function classifyNli(
  claim: string,
  evidence: string,
  sourceUrl: string,
  model: LLM,
): Promise<NliResult> {
  const shortEvidence = evidence.slice(0, 3500)
  // Static prior: if the source domain is in our credibility table, lock the
  // credibility score and only ask the LLM for stance. This removes one
  // dimension of LLM judgement on sources whose tier is not really debatable.
  const prior = domainCredibility(sourceUrl)
  const promptTemplate = prior === null ? PROMPT_WITH_CREDIBILITY : PROMPT_STANCE_ONLY
  const prompt = `${promptTemplate}\n\nCLAIM: ${claim}\nSOURCE: ${sourceUrl}\nEVIDENCE: ${shortEvidence}`
  let response
  try {
    response = await model.invoke(prompt)
  } catch (err) {
    console.warn('[nli] model failed, using heuristic:', (err as Error).message)
    const h = heuristic(claim, evidence)
    return prior === null ? h : { ...h, credibilityScore: prior }
  }
  const obj = extractJsonObject<{
    stance?: unknown
    credibilityScore?: unknown
    rationale?: unknown
  }>(messageText(response.content))
  if (!obj) {
    const h = heuristic(claim, evidence)
    return prior === null ? h : { ...h, credibilityScore: prior }
  }
  const stance: NliStance =
    obj.stance === 'SUPPORTS' || obj.stance === 'CONTRADICTS' ? obj.stance : 'NEUTRAL'
  const rationale = typeof obj.rationale === 'string' ? obj.rationale : ''
  const credibilityScore =
    prior !== null
      ? prior
      : typeof obj.credibilityScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(obj.credibilityScore)))
        : 55
  return { stance, credibilityScore, rationale }
}
