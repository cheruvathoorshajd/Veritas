# VERITAS — Master Claude Code Build Prompt
# End-to-end AI conversation fact-checker, production-ready, zero cost

---

## MISSION

Build **Veritas** from scratch: a complete, deployable Next.js 14 application that transcribes
any conversation (mic / file / text), extracts every verifiable factual claim using a
multi-agent LangGraph pipeline, verifies each claim against live web sources via open-domain
Web RAG, and issues per-speaker evidence-backed verdicts with confidence scores.

Total infrastructure cost: $0/month. Deployable to Vercel on the free tier.

---

## BEFORE YOU START — READ THIS FULLY

Work through every phase in order. Do not skip phases. Do not stub functions — implement
them completely. After each phase, run the test command specified and fix any errors before
proceeding. At the end, the app must run locally with `pnpm dev` and deploy with `vercel --prod`.

---

## ENVIRONMENT VARIABLES REQUIRED

Create `.env.local` at project root and `.env.example` with these keys (no values in example):

```
# AI / LLM
GOOGLE_GENERATIVE_AI_API_KEY=        # Gemini 2.0 Flash — free 1M tokens/day
GROQ_API_KEY=                        # Groq Whisper + Llama fallback — free tier

# Search / Retrieval
TAVILY_API_KEY=                      # Tavily search — 1000 free searches/month

# Transcription + Diarization
ASSEMBLYAI_API_KEY=                  # File upload transcription + speaker diarization

# Database
NEXT_PUBLIC_SUPABASE_URL=            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=           # Supabase service role (server-only)

# Observability
LANGCHAIN_API_KEY=                   # LangSmith tracing — 5000 traces/month free
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=veritas

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## TECH STACK — DO NOT DEVIATE

| Layer | Package | Version |
|---|---|---|
| Framework | next | 14.2.x |
| Language | typescript | 5.x |
| Styling | tailwindcss | 3.x (utility helpers only) |
| Agent Orchestration | @langchain/langgraph | latest |
| LLM Primary | @langchain/google-genai + @google/generative-ai | latest |
| LLM Fallback | @langchain/groq | latest |
| Web Search | @tavily/core | latest |
| Transcription/Diarization | assemblyai | latest |
| Database | @supabase/supabase-js | latest |
| Observability | langsmith | latest |
| Streaming | Native Next.js SSE (no socket.io) | — |
| Package manager | pnpm | — |

---

## COMPLETE PROJECT STRUCTURE

Generate this exact structure:

```
veritas/
├── .env.local                          # Real env vars (gitignored)
├── .env.example                        # Template (committed)
├── .gitignore
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── vercel.json
├── CLAUDE.md                           # Project context for future Claude sessions
│
├── app/
│   ├── layout.tsx                      # Root layout with fonts + metadata
│   ├── page.tsx                        # Landing page
│   ├── app/
│   │   └── page.tsx                    # Product app page
│   ├── globals.css                     # Design system CSS variables
│   └── api/
│       ├── session/
│       │   ├── route.ts                # POST — create session
│       │   └── [id]/
│       │       ├── route.ts            # GET — fetch session
│       │       └── report/
│       │           └── route.ts        # GET — export PDF report
│       ├── transcribe/
│       │   └── route.ts                # POST — file upload → AssemblyAI
│       ├── diarize/
│       │   └── route.ts                # POST — speaker segment assignment
│       ├── pipeline/
│       │   └── route.ts                # POST — full claim→verdict pipeline (SSE stream)
│       └── health/
│           └── route.ts                # GET — health check all services
│
├── lib/
│   ├── agents/
│   │   ├── graph.ts                    # LangGraph state machine (root)
│   │   ├── claim-extraction.ts         # Agent 1: NER + claim detection + coref + SRL
│   │   ├── verification.ts             # Agent 2: ReAct loop (search→compress→NLI→decide)
│   │   ├── verdict.ts                  # Agent 3: evidence synthesis + confidence scoring
│   │   └── report.ts                   # Agent 4: per-speaker report generation
│   ├── nlp/
│   │   ├── claim-detector.ts           # Opinion vs fact classifier
│   │   ├── query-reformulator.ts       # Claim → optimal search query
│   │   └── nli.ts                      # Natural Language Inference (support/contradict/neutral)
│   ├── retrieval/
│   │   ├── tavily.ts                   # Tavily search wrapper
│   │   ├── wikipedia.ts                # Wikipedia API wrapper
│   │   ├── politifact.ts               # PolitiFact RSS parser
│   │   └── compress.ts                 # Document → 200-300 word summary
│   ├── transcription/
│   │   ├── assemblyai.ts               # File upload transcription + diarization
│   │   └── web-speech.ts               # Browser Web Speech API helper types
│   ├── db/
│   │   ├── client.ts                   # Supabase client (server)
│   │   ├── browser-client.ts           # Supabase client (browser)
│   │   ├── sessions.ts                 # Session CRUD
│   │   └── schema.sql                  # Supabase schema (run once)
│   ├── types/
│   │   └── index.ts                    # All shared TypeScript types
│   └── utils/
│       ├── stream.ts                   # SSE helpers
│       └── rate-limit.ts               # Simple in-memory rate limiter
│
└── components/
    ├── landing/
    │   ├── Hero.tsx
    │   ├── Problem.tsx
    │   ├── Novelties.tsx
    │   ├── Pipeline.tsx
    │   ├── Market.tsx
    │   └── ProductCTA.tsx
    └── app/
        ├── AppShell.tsx                # Root app container
        ├── Header.tsx                  # Logo + status badge + run button
        ├── InputSection.tsx            # Tabs: mic / file / text
        ├── MicInput.tsx                # Web Speech API + waveform
        ├── FileInput.tsx               # Drag-drop file upload
        ├── TextInput.tsx               # Textarea + submit
        ├── PipelineBar.tsx             # 6-stage animated pipeline
        ├── TranscriptFeed.tsx          # Speaker-labeled rolling transcript
        ├── VerdictFeed.tsx             # Claim verdicts with confidence bars
        ├── SpeakerScores.tsx           # Per-speaker accuracy summary
        └── ExportButton.tsx            # PDF report download
```

---

## PHASE 1 — PROJECT INITIALISATION

```bash
pnpm create next-app@latest veritas --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
cd veritas
pnpm add @langchain/langgraph @langchain/google-genai @langchain/groq @langchain/core
pnpm add @google/generative-ai
pnpm add @tavily/core
pnpm add assemblyai
pnpm add @supabase/supabase-js
pnpm add langsmith
pnpm add @langchain/community
pnpm add rss-parser
pnpm add -D @types/node
```

After install, verify `package.json` has all packages, then run:
```bash
pnpm build
```
Fix any TypeScript errors before proceeding.

**Test:** `pnpm dev` must start on port 3000 with default Next.js page.

---

## PHASE 2 — TYPES & DESIGN SYSTEM

### `lib/types/index.ts`

Define these TypeScript interfaces exactly:

```typescript
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
  id: string           // 'A', 'B', 'C', etc.
  label: string        // 'Speaker A' or user-assigned name
  claimsTotal: number
  claimsVerified: number
  claimsFalse: number
  claimsMisleading: number
  claimsUnverified: number
  accuracyPct: number  // claimsVerified / claimsTotal * 100
}

export interface TranscriptLine {
  id: string
  speaker: string      // 'A', 'B', etc.
  text: string
  timestamp: string    // '0:14'
  startMs: number
  endMs: number
}

export interface ExtractedClaim {
  id: string
  speaker: string
  timestamp: string
  originalText: string   // the sentence it came from
  claimText: string      // the isolated claim
  searchQuery: string    // reformulated for web search
  isCheckworthy: boolean
}

export interface Evidence {
  source: string
  url: string
  excerpt: string        // compressed to 200-300 words
  stance: 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL'
  credibilityScore: number  // 0-100
}

export interface Verdict {
  id: string
  claimId: string
  speaker: string
  timestamp: string
  claimText: string
  label: VerdictLabel
  confidencePct: number   // 0-100
  explanation: string     // one paragraph, plain English
  evidence: Evidence[]
  searchQueries: string[] // all queries that were run
  iterationsUsed: number  // how many ReAct loops ran (max 3)
  approvalRequired: boolean  // true if confidence 40-70%
  approved: boolean | null   // null = pending, true/false = decided
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

// SSE event types
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
```

### `app/globals.css`

Replace the default globals.css with this exact design system. This IS the visual identity — do not modify the color values:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Veritas design system — Editorial Brutalist */
  --bg: #080808;
  --surface: #0F0F0F;
  --card: #111111;
  --border: #141414;
  --border-bright: #222222;

  /* Typography */
  --text: #DEDAD2;
  --text-muted: #404040;
  --text-dim: #1E1E1E;

  /* Semantic verdict colours */
  --coral: #FF3D2E;        /* FALSE + brand accent */
  --coral-dim: #1A0A08;
  --teal: #00D98B;         /* VERIFIED */
  --teal-dim: #071410;
  --amber: #FFAB00;        /* MISLEADING */
  --amber-dim: #1A1200;
  --gray-v: #404040;       /* UNVERIFIED */

  /* Speaker colours */
  --speaker-a: #5A8FD6;
  --speaker-b: #46B88A;
  --speaker-c: #C084FC;
  --speaker-d: #FB923C;

  /* Typography scale */
  --font-display: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
}

html { scroll-behavior: smooth; }
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

/* Scroll bar */
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-bright); border-radius: 2px; }

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse-ring {
  0%,100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.12; transform: scale(1.6); }
}
@keyframes scan-line {
  0%   { left: -35%; }
  100% { left: 120%; }
}
@keyframes wave-bar {
  0%,100% { height: 2px; }
  50%     { height: var(--h, 12px); }
}
@keyframes blink {
  0%,100% { opacity: 1; }
  50%     { opacity: 0; }
}
@keyframes line-grow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes count-up {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.visible { opacity: 1; transform: translateY(0); }
.delay-1 { transition-delay: 0.1s; }
.delay-2 { transition-delay: 0.2s; }
.delay-3 { transition-delay: 0.3s; }
.delay-4 { transition-delay: 0.4s; }
.delay-5 { transition-delay: 0.5s; }
.delay-6 { transition-delay: 0.6s; }

/* Utility: section label */
.section-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 2.5px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
}
.section-label .num { color: var(--text-dim); }

/* Verdict colour utilities */
.verdict-VERIFIED  { color: var(--teal); }
.verdict-FALSE     { color: var(--coral); }
.verdict-MISLEADING{ color: var(--amber); }
.verdict-UNVERIFIED{ color: var(--gray-v); }
.verdict-bg-VERIFIED  { background: var(--teal-dim); border-color: rgba(0,217,139,.25); }
.verdict-bg-FALSE     { background: var(--coral-dim); border-color: rgba(255,61,46,.25); }
.verdict-bg-MISLEADING{ background: var(--amber-dim); border-color: rgba(255,171,0,.25); }
.verdict-bg-UNVERIFIED{ background: var(--card); border-color: var(--border); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

**Test:** `pnpm build` — no TypeScript errors.

---

## PHASE 3 — DATABASE SCHEMA

### `lib/db/schema.sql`

```sql
-- Run this once in Supabase SQL editor

create extension if not exists "uuid-ossp";

create table sessions (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz default now(),
  input_mode  text not null check (input_mode in ('mic','file','text')),
  stage       text not null default 'idle',
  error       text,
  raw_transcript  jsonb default '[]',
  claims          jsonb default '[]',
  verdicts        jsonb default '[]',
  speakers        jsonb default '[]'
);

create index sessions_created_at_idx on sessions(created_at desc);

-- Row level security (optional, enable for multi-user)
alter table sessions enable row level security;
create policy "anon read own session" on sessions for select using (true);
create policy "anon insert session"   on sessions for insert with check (true);
create policy "anon update session"   on sessions for update using (true);
```

### `lib/db/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### `lib/db/sessions.ts`

Implement full CRUD:
- `createSession(inputMode)` → returns Session
- `getSession(id)` → returns Session | null
- `updateSession(id, partial)` → returns Session
- `appendTranscriptLine(id, line)` → void
- `appendVerdict(id, verdict)` → void
- `updateSpeakers(id, speakers)` → void

All functions must handle Supabase errors gracefully and throw typed errors.

---

## PHASE 4 — TRANSCRIPTION & DIARIZATION

### `lib/transcription/assemblyai.ts`

Implement `transcribeFile(audioBuffer: Buffer, fileName: string): Promise<TranscriptLine[]>`:

1. Upload buffer to AssemblyAI using `client.files.upload(buffer)`
2. Create transcript job with `speaker_labels: true`, `speakers_expected: null` (auto-detect)
3. Poll until status is `completed` with 2s backoff
4. Map AssemblyAI `utterances` array to `TranscriptLine[]`:
   - `speaker` → map AssemblyAI `A/B/C` to our `A/B/C`
   - `text` → transcript text
   - `start` / `end` → ms values
   - `timestamp` → format as `M:SS`
5. Return sorted by `startMs`

Handle errors: file too large (>100MB), unsupported format, API timeout.
Supported formats: mp3, mp4, wav, m4a, webm, ogg, flac.

### `lib/transcription/web-speech.ts`

Export these TypeScript types and helper functions for browser-side use:

```typescript
export interface WebSpeechResult {
  transcript: string
  isFinal: boolean
  confidence: number
}

export function formatTimestamp(ms: number): string
// Returns 'M:SS' format

export function chunkToTranscriptLine(
  text: string,
  speaker: string,
  startMs: number
): TranscriptLine
```

The actual Web Speech API interaction happens client-side in `MicInput.tsx`.

---

## PHASE 5 — RETRIEVAL LAYER

### `lib/retrieval/tavily.ts`

```typescript
import { TavilySearchResults } from "@langchain/community/tools/tavily_search"

export async function searchTavily(query: string, maxResults = 5): Promise<SearchResult[]>
// Returns array of { title, url, content, score }
// Catch rate limit errors and return empty array with console.warn
```

### `lib/retrieval/wikipedia.ts`

```typescript
export async function searchWikipedia(query: string): Promise<SearchResult | null>
// Uses https://en.wikipedia.org/api/rest_v1/page/summary/{encoded_query}
// Returns first paragraph as content, url as article URL
// Returns null if 404 or network error
```

### `lib/retrieval/politifact.ts`

```typescript
import Parser from 'rss-parser'

export async function searchPolitifact(query: string): Promise<SearchResult[]>
// Fetch https://www.politifact.com/rss/rulings/
// Filter items whose title contains any word from the query (case-insensitive)
// Return top 3 matches with verdict in content
// Cache feed for 15 minutes in module-level Map to avoid hammering RSS
```

### `lib/retrieval/compress.ts`

```typescript
export async function compressDocument(
  content: string,
  claim: string,
  model: ChatGoogleGenerativeAI
): Promise<string>
// Prompt: "Summarise the following document in 200-300 words,
// keeping only information relevant to verifying this claim: {claim}
// Document: {content}"
// Returns summary string
```

---

## PHASE 6 — AGENT PIPELINE (LANGGRAPH)

### `lib/agents/graph.ts`

This is the core of Veritas. Implement a LangGraph StateGraph with this exact state shape:

```typescript
import { StateGraph, Annotation } from "@langchain/langgraph"

const VeritasState = Annotation.Root({
  // Input
  transcriptLines: Annotation<TranscriptLine[]>({ reducer: (a, b) => b }),
  inputMode: Annotation<InputMode>({ reducer: (a, b) => b }),

  // Processing
  claims: Annotation<ExtractedClaim[]>({ reducer: (a, b) => [...a, ...b] }),
  currentClaimIndex: Annotation<number>({ reducer: (a, b) => b }),

  // Verification state (per-claim)
  searchResults: Annotation<Evidence[]>({ reducer: (a, b) => b }),
  iterationCount: Annotation<number>({ reducer: (a, b) => b }),
  searchQueries: Annotation<string[]>({ reducer: (a, b) => [...a, ...b] }),

  // Output
  verdicts: Annotation<Verdict[]>({ reducer: (a, b) => [...a, ...b] }),
  speakers: Annotation<Speaker[]>({ reducer: (a, b) => b }),

  // Control
  stage: Annotation<PipelineStage>({ reducer: (a, b) => b }),
  error: Annotation<string | null>({ reducer: (a, b) => b }),
})
```

Build the graph with these nodes:

**Node: `extract_claims`**
- Calls `lib/agents/claim-extraction.ts`
- Extracts all checkworthy claims from transcript
- Updates `claims` and `stage: 'extract'`

**Node: `verify_claim`**
- Calls `lib/agents/verification.ts`
- Processes `claims[currentClaimIndex]`
- Runs the ReAct loop (max 3 iterations)
- Updates `verdicts`, `searchResults`, `iterationCount`

**Node: `synthesise_verdict`**
- Calls `lib/agents/verdict.ts`
- Takes evidence bundle, produces structured Verdict
- Updates `verdicts`

**Node: `next_claim`**
- Increments `currentClaimIndex`
- Routes: if more claims → back to `verify_claim`, else → `generate_report`

**Node: `generate_report`**
- Calls `lib/agents/report.ts`
- Computes per-speaker stats
- Updates `speakers` and `stage: 'complete'`

**Edges:**
```
START → extract_claims
extract_claims → verify_claim (if claims.length > 0) | generate_report (if empty)
verify_claim → synthesise_verdict
synthesise_verdict → next_claim
next_claim → verify_claim | generate_report (conditional)
generate_report → END
```

Export: `export const veritasGraph = graph.compile()`

### `lib/agents/claim-extraction.ts`

Implement `extractClaims(lines: TranscriptLine[], model): Promise<ExtractedClaim[]>`:

System prompt (use exactly):
```
You are a claim extraction specialist. Your job is to identify every verifiable factual
claim in the provided transcript. A claim is checkworthy if it:
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

Return a JSON array. No markdown. No preamble.
```

Parse the JSON response. Handle malformed output gracefully (try-catch, return empty array).
Assign UUIDs to each claim.

### `lib/agents/verification.ts`

Implement `runReActVerification(claim: ExtractedClaim, model, maxIterations = 3): Promise<Evidence[]>`:

The ReAct loop:
```
iteration = 0
evidence = []

while iteration < maxIterations:
  1. Formulate search query (LLM reformulates based on previous results)
  2. Run parallel searches: Tavily, Wikipedia, PolitiFact
  3. Compress each result with compressDocument()
  4. Run NLI on each compressed result vs the claim
  5. Check: is evidence sufficient?
     - Sufficient if: 2+ SUPPORTS or 1+ CONTRADICTS from credible sources
     - If sufficient: break loop
     - If not: increment iteration, refine query
  6. Add evidence to array

return evidence
```

For step 1 on iteration > 0, pass previous evidence summaries to LLM to refine query.
Log each iteration to LangSmith via `traceable` wrapper.

### `lib/agents/verdict.ts`

Implement `synthesiseVerdict(claim: ExtractedClaim, evidence: Evidence[], model): Promise<Verdict>`:

System prompt:
```
You are a fact-checking verdict analyst. Given a claim and supporting evidence,
produce a structured verdict.

Rules:
- VERIFIED: 2+ credible sources consistently support the claim
- FALSE: 1+ credible source directly contradicts the specific claim with data
- MISLEADING: claim is technically true but omits critical context, cherry-picks
              data, or creates a false impression
- UNVERIFIED: insufficient evidence to confirm or deny

Confidence scoring (0-100):
- 90-100: overwhelming consistent evidence
- 70-89: strong evidence, minor ambiguity
- 40-69: mixed or incomplete evidence (flag for human review)
- 0-39: contradictory evidence

Return JSON exactly:
{
  "label": "VERIFIED|FALSE|MISLEADING|UNVERIFIED",
  "confidencePct": <number>,
  "explanation": "<one clear paragraph explaining the verdict, citing specific sources>"
}
No markdown. No preamble.
```

Set `approvalRequired: true` if `confidencePct >= 40 && confidencePct <= 70`.

### `lib/agents/report.ts`

Implement `generateReport(verdicts: Verdict[], transcriptLines: TranscriptLine[]): Speaker[]`:

For each unique speaker in transcriptLines:
- Count total claims
- Count by verdict label
- Calculate `accuracyPct = claimsVerified / claimsTotal * 100` (0 if no claims)
- Sort speakers by total claims desc

Return `Speaker[]` array.

---

## PHASE 7 — API ROUTES

### `app/api/health/route.ts`

GET endpoint. Check all external services:
- Gemini: test with a 1-token prompt
- Tavily: test with a 1-result search
- AssemblyAI: test with SDK `.getTranscript()` dummy call
- Supabase: test with a simple select

Return `{ status: 'ok' | 'degraded', services: { [name]: 'ok' | 'error' } }`

### `app/api/transcribe/route.ts`

POST endpoint. Accepts `multipart/form-data` with `file` field.

1. Validate file: must be audio/video, max 100MB
2. Read buffer from formData
3. Call `transcribeFile()` from assemblyai.ts
4. Return `{ lines: TranscriptLine[] }`

Include proper error handling: 413 for oversized, 422 for wrong type, 500 for API errors.

### `app/api/pipeline/route.ts`

POST endpoint with **Server-Sent Events streaming response**.

Request body:
```typescript
{
  sessionId: string
  transcriptLines: TranscriptLine[]
  inputMode: InputMode
}
```

Implementation:
1. Create SSE response with `Content-Type: text/event-stream`
2. Create LangSmith tracer
3. Run `veritasGraph.stream(initialState, { callbacks: [tracer] })`
4. For each streamed node output, emit SSE events using `StreamEvent` types
5. On complete, update Supabase session
6. Handle client disconnect (abort signal)

SSE format:
```
data: {"type":"stage","stage":"extract"}\n\n
data: {"type":"claim_detected","claim":{...}}\n\n
data: {"type":"verdict","verdict":{...}}\n\n
data: {"type":"complete","sessionId":"..."}\n\n
```

### `app/api/session/route.ts`

POST: create new session → return `{ sessionId: string }`

### `app/api/session/[id]/route.ts`

GET: fetch full session by ID → return `Session`

### `app/api/session/[id]/report/route.ts`

GET: generate PDF report.

Build a plain HTML report string:
- Title: "Veritas Fact-Check Report"
- Session ID + date
- Per-speaker accuracy table
- All verdicts grouped by speaker, sorted by timestamp
- Each verdict: label (large), claim, confidence%, explanation, sources

Return as HTML (Content-Type: text/html) — users can print-to-PDF from browser.
On a future iteration this can be replaced with puppeteer for true PDF.

---

## PHASE 8 — FRONTEND: LANDING PAGE

### `app/page.tsx`

Import and render all landing components in order:

```tsx
export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Novelties />
      <Pipeline />
      <Market />
      <ProductCTA />
    </main>
  )
}
```

### `components/landing/Hero.tsx`

Design spec (implement exactly):
- Black background, full width
- Nav bar: `VERITAS` in monospace + nav links (Novelty, Pipeline, Product)
- Giant `THE\nTRUTH\nMACHINE.` headline at 82px, monospace, letter-spacing -3px, `MACHINE.` in coral `#FF3D2E`
- Two-column row: left = 18px tagline, right = 13px description + two CTAs
- CTA 1 "See the product" → smooth-scroll to `#product`, solid white bg, dark text
- CTA 2 "GitHub" → links to `https://github.com`
- Bottom bar: thin hairline separator + 5 facts in monospace (separated by dots)

Implement IntersectionObserver scroll reveal on all elements.

### `components/landing/Problem.tsx`

- Section label `(00) The problem`
- Quote: "Fact-checking tools exist — but none of them are built for you." in 26px
- 4 stat items in a grid (border-top accent on first):
  - `6×` faster false news spreads than truth
  - `$0` cost of every existing free consumer fact-checker that actually works
  - `100%` of live fact-checking tools require enterprise contracts
  - `0` public tools that tell you which speaker made a false claim

### `components/landing/Novelties.tsx`

Section label `(01) What makes Veritas different`

2-column grid of 6 novelty items. Each item has:
- Number `01` through `06` in mono
- Title 17px 500 weight
- Description 12px #666
- Tag pill with appropriate colour

Six items exactly:
1. "Multi-input unified" — mic + file + text in one pipeline — tag: `Web Speech API + Whisper` (teal)
2. "Per-speaker attribution" — Pyannote diarization — tag: `Pyannote · 90-95% accuracy` (teal)
3. "Open-domain Web RAG" — live internet, never stale — tag: `Tavily + Wikipedia + PolitiFact` (amber)
4. "Multi-agent ReAct" — 4 specialised agents — tag: `LangGraph · Gemini Flash` (no colour)
5. "Completely free" — $0/month — tag: `$0 / month forever` (coral)
6. "Exportable reports" — shareable per-speaker — tag: `PDF · share link` (no colour)

### `components/landing/Pipeline.tsx`

Section label `(02) How it works`

Intro: "Six layers. Eight to fifteen seconds. Speech to verdict." at 26px

6-dot pipeline visualiser: coral first dot, teal last dot, lines between all dots.
Animated: when section scrolls into view, lines `scaleX(0)` → `scaleX(1)` with 200ms stagger.

Below: 6 columns matching the dots:
- 01 Input, 02 Transcribe, 03 Diarize, 04 Extract, 05 Verify, 06 Verdict
- Each with small coral number, 12px title, 11px grey description

### `components/landing/Market.tsx`

Section label `(03) Vs. the market`

2-column layout:
- Left "The field" with coral top border: 6 competitor items, each with red dot + description
- Right "Veritas" with teal top border: 6 differentiators, each with green dot + description

### `components/landing/ProductCTA.tsx`

Section label `(04) The product`

Large `Try it now.` at 42px.
Subtitle: "Run the demo to see the full pipeline in action."
Big `→ Open the app` CTA that navigates to `/app`.

---

## PHASE 9 — FRONTEND: PRODUCT APP

### `app/app/page.tsx`

```tsx
export default function AppPage() {
  return <AppShell />
}
```

### `components/app/AppShell.tsx`

Root state container. Manages:
- `session: Session | null`
- `stage: PipelineStage`
- `inputMode: InputMode`
- `transcriptLines: TranscriptLine[]` (live, updates via SSE)
- `verdicts: Verdict[]` (live, updates via SSE)
- `speakers: Speaker[]` (live, updates via SSE)

Renders:
```tsx
<div style={{ background: '#080808', color: '#DEDAD2', fontFamily: 'var(--font-body)' }}>
  <Header stage={stage} onRunDemo={handleDemo} onReset={handleReset} />
  <section id="input">
    <SectionLabel num="01" text="Input" />
    <InputSection inputMode={inputMode} onModeChange={setInputMode}
                  onTranscript={handleTranscript} stage={stage} />
    <PipelineBar stage={stage} />
  </section>
  <section id="transcript">
    <SectionLabel num="02" text="Transcript" />
    <TranscriptFeed lines={transcriptLines} />
  </section>
  <section id="verdicts">
    <SectionLabel num="03" text={`Verdicts — ${verdicts.length} claims checked`} />
    <VerdictFeed verdicts={verdicts} onApprove={handleApprove} />
  </section>
  {speakers.length > 0 && (
    <section id="speakers">
      <SectionLabel num="04" text="Speaker accuracy" />
      <SpeakerScores speakers={speakers} />
      <ExportButton sessionId={session?.id} />
    </section>
  )}
</div>
```

### `components/app/Header.tsx`

- `VERITAS` in monospace 16px letter-spacing 4px
- Status badge in parentheses: `(READY)` / `(LIVE)` / `(VERIFYING)` / `(COMPLETE)`
  - LIVE = teal colour
  - VERIFYING = amber colour
- Session info text (right)
- "Run demo" / "Run again" button (transparent border style)

### `components/app/InputSection.tsx`

Three tabs: `Mic live` / `File upload` / `Text paste`

Tab active state: `border: 1px solid #404040; color: #DEDAD2`
Tab inactive: `border: 1px solid #1A1A1A; color: #2E2E2E`

Renders active panel based on `inputMode`.

### `components/app/MicInput.tsx`

Implement fully functional Web Speech API microphone recording:

```typescript
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)()
recognition.continuous = true
recognition.interimResults = true
recognition.lang = 'en-US'
```

- Mic circle button: 38px, border: 1px solid #1A1A1A, clicking toggles recording
- Active state: border-color: var(--coral), pulse-ring animation
- Waveform bars: 15 bars, random heights, `animation: wave-bar` when recording
- Label: `STANDBY` / `RECORDING` / `SESSION ENDED`
- On `finalResult`: call `onFinalTranscript(text: string)` prop
- On `interimResult`: call `onInterimTranscript(text: string)` prop (display only)
- Show interim text as faded preview below waveform

### `components/app/FileInput.tsx`

- Drag-drop zone: `border: 1px dashed #1E1E1E`
- Accepted: `audio/*,video/*`
- On drop/select: show filename + size, call `onFileSelected(file: File)` prop
- Show upload progress indicator when transcribing

### `components/app/TextInput.tsx`

- `textarea`: `background: #0F0F0F; border: 1px solid #1A1A1A; color: #DEDAD2`
- Placeholder: "Paste a conversation or transcript here..."
- Submit button: full width, coral background
- Parses pasted text: if it detects `Speaker A:` or `A:` format, split into TranscriptLines automatically

### `components/app/PipelineBar.tsx`

6 stages: Input → ASR → Diarize → Extract → Verify → Verdict

Each stage:
- 6px dot: `background: #141414; border: 1px solid #1E1E1E` (idle)
- Active: coral dot + pulse-ring animation
- Done: teal dot, teal connector line

Connector lines: 1px height, `transform-origin: left`, `scaleX(0)` → `scaleX(1)` on done.

Stage label below each dot: 8px monospace.
Active label: amber. Done label: teal. Idle: #1E1E1E.

Mapping from `PipelineStage`:
```
idle       → all idle
input      → Input active
transcribe → Input done, ASR active
diarize    → ASR done, Diarize active
extract    → Diarize done, Extract active
verify     → Extract done, Verify active
verdict    → Verify done, Verdict active
complete   → all done
```

### `components/app/TranscriptFeed.tsx`

List of `TranscriptLine` items. Each item:
```
[A]  "The unemployment rate is 2.1 percent."          0:14
```

- Speaker chip: 10px monospace, colour from `--speaker-a/b/c/d`
- Speaker A chip background: `#101828`, colour: `#5A8FD6`, border: `#1A2A50`
- Speaker B chip background: `#081612`, colour: `#46B88A`, border: `#0F2E20`
- Text: 12px, line-height 1.6, color #888
- Time: 10px monospace, right-aligned, color #222
- `animation: fadeUp 0.35s ease` on new items

When a claim is extracted from a line, show below it:
```
│ [CLAIM DETECTED]
│ Unemployment rate is 2.1%
```
Border-left: 1px solid var(--coral). Background: var(--coral-dim). Animate in.

### `components/app/VerdictFeed.tsx`

Each verdict item:

```
FALSE                                  91%
"US unemployment rate is 2.1%"
Speaker A  ·  0:14  ·  via Bureau of Labor Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Layout:
- `FALSE` / `VERIFIED` / `MISLEADING` / `UNVERIFIED` at 30px, 500 weight, colour from verdict
- Confidence % at 20px monospace, right-aligned, opacity 0.15
- Claim text in quotes at 13px
- Meta row: speaker in speaker colour, dot separator, timestamp, dot, source
- 1px hairline bar that animates from 0% to `confidencePct`% width on mount
- Bar colour matches verdict label

Hover state: `background: #0F0F0F` subtly.

If `approvalRequired === true` and `approved === null`:
Show approval widget below verdict:
- "Confidence 40-70% — review required" in amber
- Two buttons: `Confirm verdict` (border amber) and `Override` (border coral)
- On click: call `onApprove(verdictId, approved: boolean)`

On `approved`: show small `[CONFIRMED]` or `[OVERRIDDEN]` badge.

### `components/app/SpeakerScores.tsx`

Per-speaker cards side by side:

```
Speaker A · 4 claims
33%
1/4 accurate
```

- Speaker label: 10px monospace in speaker colour
- Percentage: 44px, 500 weight, letter-spacing -3px
- Colour: teal if >= 60%, coral if < 60%
- Sub: 10px monospace, #333

### `components/app/ExportButton.tsx`

Simple button: `Download report →`
On click: `window.open(\`/api/session/${sessionId}/report\`, '_blank')`
Style: transparent, border 1px #1E1E1E, 10px monospace, letter-spacing 1.5px.

---

## PHASE 10 — DEMO MODE

In `AppShell.tsx`, implement a `handleDemo()` function that simulates a real session
using pre-canned data WITHOUT calling any external APIs.

Demo transcript (hard-coded):
```typescript
const DEMO_TRANSCRIPT: TranscriptLine[] = [
  { id:'1', speaker:'A', text:'The United States unemployment rate is currently at a historic low of 2.1 percent.', timestamp:'0:14', startMs:14000, endMs:18000 },
  { id:'2', speaker:'B', text:'Inflation has dropped to well under one percent this year, according to Federal Reserve data.', timestamp:'0:31', startMs:31000, endMs:36000 },
  { id:'3', speaker:'A', text:'Regardless, Apple remains the most valuable company in the world right now.', timestamp:'0:48', startMs:48000, endMs:52000 },
  { id:'4', speaker:'B', text:'Climate scientists confirm temperatures have risen by 3 degrees Celsius since pre-industrial times.', timestamp:'1:05', startMs:65000, endMs:71000 },
]

const DEMO_VERDICTS: Verdict[] = [
  { id:'v1', claimId:'c1', speaker:'A', timestamp:'0:14', claimText:'US unemployment rate is 2.1%', label:'FALSE', confidencePct:91, explanation:'Bureau of Labor Statistics data shows the unemployment rate at approximately 3.9%, not 2.1% as claimed. The claim significantly understates the actual figure.', evidence:[{ source:'Bureau of Labor Statistics', url:'https://bls.gov', excerpt:'Current unemployment rate 3.9%', stance:'CONTRADICTS', credibilityScore:98 }], searchQueries:['US unemployment rate 2024'], iterationsUsed:1, approvalRequired:false, approved:null },
  { id:'v2', claimId:'c2', speaker:'B', timestamp:'0:31', claimText:'Inflation dropped to under 1% this year', label:'FALSE', confidencePct:87, explanation:'Federal Reserve and CPI data show inflation at approximately 3.2%, significantly above the 1% threshold claimed.', evidence:[{ source:'Federal Reserve', url:'https://federalreserve.gov', excerpt:'CPI inflation 3.2% year-over-year', stance:'CONTRADICTS', credibilityScore:99 }], searchQueries:['US CPI inflation rate 2024'], iterationsUsed:1, approvalRequired:false, approved:null },
  { id:'v3', claimId:'c3', speaker:'A', timestamp:'0:48', claimText:'Apple is the most valuable company in the world', label:'VERIFIED', confidencePct:94, explanation:'Apple consistently holds the highest market capitalisation globally, a status confirmed by multiple financial data sources.', evidence:[{ source:'Bloomberg Markets', url:'https://bloomberg.com', excerpt:'Apple market cap $3.5T, highest globally', stance:'SUPPORTS', credibilityScore:95 }], searchQueries:['largest company market cap 2024'], iterationsUsed:1, approvalRequired:false, approved:null },
  { id:'v4', claimId:'c4', speaker:'B', timestamp:'1:05', claimText:'Global temps risen 3°C since pre-industrial era', label:'MISLEADING', confidencePct:82, explanation:'IPCC data shows global temperatures have risen approximately 1.2°C since pre-industrial times. The 3°C figure represents a projected future scenario under high-emission pathways, not current measurements.', evidence:[{ source:'IPCC Report 2023', url:'https://ipcc.ch', excerpt:'1.1-1.2°C warming observed since pre-industrial era', stance:'CONTRADICTS', credibilityScore:99 }], searchQueries:['global temperature rise since pre-industrial IPCC'], iterationsUsed:2, approvalRequired:false, approved:null },
]
```

Animate the demo using `async/await` with `setTimeout`:
- 600ms: set stage `input`
- 800ms: set stage `transcribe`
- Each 1200ms: add next transcript line
- 500ms after line: show claim extracted
- 600ms: set stage `verify`
- 1700ms: add verdict (animate confidence bar)
- Cycle stages back to `transcribe` between claims
- Final: set stage `complete`, compute speakers

This demo must work without any API keys set.

---

## PHASE 11 — STREAMING PIPELINE INTEGRATION

In `AppShell.tsx`, implement `handlePipelineRun(lines: TranscriptLine[])`:

```typescript
const runPipeline = async (lines: TranscriptLine[]) => {
  // 1. Create session
  const { sessionId } = await fetch('/api/session', {
    method: 'POST',
    body: JSON.stringify({ inputMode })
  }).then(r => r.json())

  // 2. Open SSE stream
  const response = await fetch('/api/pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, transcriptLines: lines, inputMode }),
    signal: abortController.signal
  })

  // 3. Process SSE events
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    const events = text.split('\n\n').filter(Boolean)
    for (const event of events) {
      const data = event.replace('data: ', '')
      try {
        const parsed: StreamEvent = JSON.parse(data)
        handleStreamEvent(parsed)  // dispatches to state updates
      } catch {}
    }
  }
}
```

`handleStreamEvent` must update all relevant state slices based on event type.

---

## PHASE 12 — OBSERVABILITY

### `lib/utils/stream.ts`

```typescript
export function createSSEStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController

  const stream = new ReadableStream({
    start(c) { controller = c }
  })

  const send = (event: StreamEvent) => {
    const data = `data: ${JSON.stringify(event)}\n\n`
    controller.enqueue(encoder.encode(data))
  }

  const close = () => controller.close()

  return { stream, send, close }
}
```

In all agent files, wrap the main function with LangSmith `traceable`:

```typescript
import { traceable } from 'langsmith/traceable'

export const extractClaims = traceable(
  async function extractClaims(lines: TranscriptLine[], model): Promise<ExtractedClaim[]> {
    // implementation
  },
  { name: 'veritas:claim-extraction', project_name: 'veritas' }
)
```

Wrap `runReActVerification`, `synthesiseVerdict`, and `generateReport` identically.

---

## PHASE 13 — CONFIGURATION FILES

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['assemblyai', 'langsmith'],
  },
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
      ]
    }]
  }
}
export default config
```

### `vercel.json`

```json
{
  "functions": {
    "app/api/pipeline/route.ts": {
      "maxDuration": 60
    },
    "app/api/transcribe/route.ts": {
      "maxDuration": 30
    }
  }
}
```

### `CLAUDE.md` (generate this for future sessions)

Write a comprehensive project context file covering:
- What Veritas is and its novelties
- Complete tech stack with all package names
- All environment variables and where to get them
- The agent pipeline architecture
- The frontend design system (all colour values, typography, component structure)
- How to run tests
- How to deploy

---

## PHASE 14 — FINAL CHECKS

Run each of these and fix all errors before calling the build done:

```bash
# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Build
pnpm build

# Start production build locally
pnpm start
```

Then verify manually:
1. Landing page loads at `localhost:3000` — all 5 sections visible
2. "See the product" scrolls to `/app`
3. App page loads at `localhost:3000/app`
4. Run demo button triggers the full animated demo sequence
5. All 4 verdicts appear with animated confidence bars
6. Speaker scores appear at the bottom
7. Clicking "Download report" opens the HTML report in a new tab
8. Health check at `localhost:3000/api/health` returns JSON

---

## PHASE 15 — DEPLOYMENT

```bash
# Install Vercel CLI
pnpm add -g vercel

# Login
vercel login

# Deploy (first time creates project)
vercel

# Set all environment variables
vercel env add GOOGLE_GENERATIVE_AI_API_KEY
vercel env add GROQ_API_KEY
vercel env add TAVILY_API_KEY
vercel env add ASSEMBLYAI_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add LANGCHAIN_API_KEY
vercel env add LANGCHAIN_TRACING_V2
vercel env add LANGCHAIN_PROJECT

# Deploy to production
vercel --prod
```

After production deploy:
1. Update `NEXT_PUBLIC_APP_URL` to the Vercel domain
2. Add Vercel domain to Supabase allowed origins
3. Test the `/api/health` endpoint on production

---

## SUCCESS CRITERIA

The build is complete when:

- [ ] `pnpm build` succeeds with zero TypeScript errors and zero ESLint errors
- [ ] Demo mode works fully without any API keys (all 4 verdicts animate)
- [ ] Live pipeline works when all API keys are set
- [ ] File upload accepts audio/video and produces speaker-labelled transcript
- [ ] Mic input captures speech and builds transcript in real time
- [ ] Text paste detects `Speaker A:` format and splits correctly
- [ ] All 4 verdict labels render in their correct colours
- [ ] Confidence bars animate smoothly on verdict appearance
- [ ] Speaker accuracy scores update in real time
- [ ] Approval widget appears for 40-70% confidence verdicts
- [ ] Report endpoint generates valid HTML report
- [ ] LangSmith traces appear in the LangSmith dashboard
- [ ] `vercel --prod` deploys successfully
- [ ] All API routes return proper error responses on bad input
- [ ] Landing page all 5 sections render and scroll-reveal correctly
- [ ] Landing page → app navigation works

---

## IMPORTANT NOTES FOR CLAUDE CODE

1. **Never stub or mock agent logic.** Implement every LangGraph node fully.
2. **The design system is fixed.** Do not change any colour values from Phase 2.
3. **The editorial aesthetic is non-negotiable:** no card containers, hairline borders only,
   verdict labels at 30px+ with weight 500, parenthetical section numbers `(01)`.
4. **Stream everything.** The pipeline API route must stream SSE events — no waiting for
   complete pipeline run before responding.
5. **Observability from day one.** Every agent function gets a `traceable` wrapper.
6. **Demo mode must work offline.** No external calls in demo mode.
7. **Error states are first-class.** Every API error must emit a `{ type: 'error' }` SSE event
   and update the session stage to `'error'` with a human-readable message.
8. **Approval loop is real.** Implement the human-in-the-loop approval for borderline verdicts.
9. **Rate limiting.** Implement basic in-memory rate limiting (10 req/min) on `/api/pipeline`.
10. **The CLAUDE.md file must be comprehensive** so any future Claude session can pick up the
    project with full context.
