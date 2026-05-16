# Veritas — Real-Time AI Conversation Fact-Checker

> End-to-end, zero-cost pipeline that transcribes conversations, extracts verifiable claims via multi-agent orchestration, verifies them against live web sources using open-domain Web RAG, and issues per-speaker evidence-backed verdicts with confidence scores.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Multi-Agent Pipeline (LangGraph)](#multi-agent-pipeline-langgraph)
4. [NLP Components](#nlp-components)
5. [Retrieval-Augmented Generation (RAG)](#retrieval-augmented-generation-rag)
6. [LLM Strategy & Resilience](#llm-strategy--resilience)
7. [Transcription & Speaker Diarization](#transcription--speaker-diarization)
8. [Streaming Architecture (SSE)](#streaming-architecture-sse)
9. [API Reference](#api-reference)
10. [Data Schema & Session Management](#data-schema--session-management)
11. [Frontend Application](#frontend-application)
12. [Tech Stack](#tech-stack)
13. [Environment Variables](#environment-variables)
14. [Getting Started](#getting-started)
15. [Key Highlights for ML Engineers](#key-highlights-for-ml-engineers)

---

## Project Overview

Veritas accepts three input modalities — **microphone** (Web Speech API), **audio/video file upload** (AssemblyAI), or **raw text paste** — and runs them through a multi-stage pipeline:

```
Input → ASR + Speaker Diarization → Claim Extraction → ReAct Verification Loop → Verdict Synthesis → Per-Speaker Report
```

Every factual claim is isolated, verified against live web evidence from multiple sources, classified via Natural Language Inference (NLI), and assigned a verdict (`VERIFIED`, `FALSE`, `MISLEADING`, `UNVERIFIED`) with a numeric confidence score (0–100). Low-confidence verdicts (40–70%) are flagged for human-in-the-loop approval.

The entire system runs on **free-tier APIs** (Gemini 2.0 Flash, Tavily, AssemblyAI, Groq, Supabase, Vercel).

### What's actually doing the work

Orchestration is a compiled **LangGraph state machine** (`lib/agents/graph.ts`). The pipeline route (`app/api/pipeline/route.ts`) hands off via `runVeritasPipeline({ transcriptLines, inputMode, model, onEvent })`, which calls `veritasGraph.stream(initialState)` under the hood. A single `ResilientLLM` instance and an `onEvent` emitter are threaded through state with replace-reducers — every node reads the same model and reports progress (stage transitions, claim detection, ReAct iterations, verdicts, speaker rollups) through the same callback. The route owns rate limiting, body parsing, session lifecycle, abort plumbing, session persistence and SSE plumbing; the graph owns orchestration.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js App)                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ MicInput │  │FileInput │  │  TextInput    │  │  PipelineBar │ │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  └──────────────┘ │
│       │              │               │                             │
│       └──────────────┴───────────────┘                             │
│                      │                                             │
│            ┌─────────▼──────────┐                                  │
│            │     AppShell       │ ← SSE consumer                   │
│            │  (React State Mgr) │                                  │
│            └─────────┬──────────┘                                  │
│                      │ fetch /api/pipeline (SSE)                   │
├──────────────────────┼─────────────────────────────────────────────┤
│                      │           SERVER (Next.js API Routes)       │
│            ┌─────────▼──────────┐                                  │
│            │  /api/pipeline     │ ← Rate-limited (10/min/IP)       │
│            │  SSE ReadableStream│                                  │
│            └─────────┬──────────┘                                  │
│                      │                                             │
│  ┌───────────────────▼───────────────────────┐                     │
│  │          LangGraph State Machine          │                     │
│  │                                           │                     │
│  │  START → extract_claims                   │                     │
│  │            │                              │                     │
│  │            ▼ (claims?)                    │                     │
│  │     ┌──verify_claim ←─────────────┐       │                     │
│  │     │      │                      │       │                     │
│  │     │      ▼                      │       │                     │
│  │     │ synthesise_verdict          │       │                     │
│  │     │      │                      │       │                     │
│  │     │      ▼                      │       │                     │
│  │     │  next_claim ─── more? ──────┘       │                     │
│  │     │      │                              │                     │
│  │     │      ▼ (no more)                    │                     │
│  │     └─ generate_report → END              │                     │
│  └───────────────────────────────────────────┘                     │
│                      │                                             │
│  ┌─────────┐  ┌──────┴──────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Tavily  │  │  Wikipedia  │  │ PolitiFact │  │  Supabase    │  │
│  │ Search  │  │  REST API   │  │  RSS Feed  │  │  (Sessions)  │  │
│  └─────────┘  └─────────────┘  └────────────┘  └──────────────┘  │
│                                                                    │
│  ┌───────────┐  ┌───────────┐  ┌────────────────────┐             │
│  │ Gemini    │  │ Groq      │  │  AssemblyAI        │             │
│  │ 2.0 Flash │  │ Llama 3.3 │  │  (ASR+Diarization) │             │
│  │ (Primary) │  │ (Fallback)│  └────────────────────┘             │
│  └───────────┘  └───────────┘                                      │
└────────────────────────────────────────────────────────────────────┘
```

---

## Multi-Agent Pipeline (LangGraph)

The core intelligence is a **LangGraph state machine** (`lib/agents/graph.ts`) with five nodes and conditional routing:

### State Definition

The graph uses `@langchain/langgraph` `Annotation.Root` to define a typed state with custom reducers:

| State Field           | Type               | Reducer Behavior                     |
|-----------------------|--------------------|--------------------------------------|
| `transcriptLines`     | `TranscriptLine[]` | Replace (last write wins)            |
| `model`               | `LLM`              | Replace (supplied once at invocation)|
| `onEvent`             | `(GraphEvent)→void`| Replace (supplied once at invocation)|
| `claims`              | `ExtractedClaim[]` | **Append** (accumulates across nodes)|
| `currentClaimIndex`   | `number`           | Replace                              |
| `searchResults`       | `Evidence[]`       | Replace (per-claim)                  |
| `iterationCount`      | `number`           | Replace (per-claim)                  |
| `currentClaimQueries` | `string[]`         | Replace (queries for the current claim only)|
| `verdicts`            | `Verdict[]`        | **Append** (accumulates)             |
| `speakers`            | `Speaker[]`        | Replace                              |
| `stage`               | `PipelineStage`    | Replace                              |

The graph is driven by `runVeritasPipeline({ transcriptLines, inputMode, model, onEvent })` which compiles the state, calls `veritasGraph.stream(initialState)` under the hood, and resolves once END is reached. The route owns rate limit, body parsing, session lifecycle, abort plumbing, session persistence and SSE plumbing — the graph owns orchestration and emits granular events (`stage`, `claim_detected`, `verifying`, `verdict`, `approval_required`, `speaker_update`, `complete`) through `onEvent` from inside each node.

### Agent Nodes

#### 1. Claim Extraction Agent (`lib/agents/claim-extraction.ts`)

- **Technique**: LLM-driven structured output extraction via prompt engineering
- **Input**: Full transcript formatted as `[SPEAKER] (TIMESTAMP) text`
- **Output**: JSON array of `ExtractedClaim` objects
- **Prompt Engineering**: System prompt defines checkworthiness criteria (statistics, causal assertions, historical facts, attributions) and anti-patterns (opinions, rhetorical questions, vague statements, future predictions)
- **Robustness**: Handles markdown-fenced JSON responses, partial JSON recovery via regex `\[[\s\S]*\]`, boolean string coercion for `isCheckworthy`, and graceful empty returns on model failure
- **Search Query Generation**: Each claim gets a reformulated 3–8 word web search query optimized for retrieval

#### 2. Verification Agent (`lib/agents/verification.ts`) — **ReAct Loop**

This is the **most ML-significant component**. It implements a **Reasoning + Acting (ReAct) loop** with up to 3 iterations:

```
For each iteration (max 3):
  1. If iteration > 0: reformulate search query using LLM
  2. Parallel retrieve from Tavily + Wikipedia + PolitiFact
  3. Deduplicate by URL
  4. For each new document:
     a. Compress document to claim-relevant summary (LLM or heuristic)
     b. Classify stance via NLI (SUPPORTS / CONTRADICTS / NEUTRAL)
     c. Assign credibility score (0-100)
  5. Check sufficiency: ≥2 supporting sources (credibility ≥60) OR ≥1 contradicting source (credibility ≥60)
  6. If sufficient → break; else → next iteration with refined query
```

**Key design decisions**:
- **Parallel retrieval**: All three sources (Tavily, Wikipedia, PolitiFact) are queried concurrently via `Promise.all` with individual catch-and-return-empty fallbacks
- **Deduplication**: Evidence is deduplicated by URL across iterations to prevent redundant NLI calls
- **Sufficiency heuristic**: The loop terminates early when evidence is conclusive, saving API calls
- **Progressive query refinement**: The query reformulator uses accumulated evidence context to generate targeted follow-up queries

#### 3. Verdict Synthesis Agent (`lib/agents/verdict.ts`)

- **Input**: Claim + gathered evidence array
- **Output**: `VerdictLabel`, `confidencePct`, `explanation`
- **LLM Classification**: Prompts Gemini with evidence block (source, URL, stance, credibility, excerpt) and expects structured JSON
- **Heuristic Fallback**: When LLM fails, applies rule-based verdict logic:
  - FALSE: ≥1 contradicting source (avg credibility ≥70), no supporting sources
  - VERIFIED: ≥2 supporting sources (avg credibility ≥65)
  - MISLEADING: Mixed support + contradiction
  - UNVERIFIED: Insufficient evidence
- **Confidence Calibration**: Score is clamped [0, 100] and drives the `approvalRequired` flag (40–70% → human review)
- **Human-in-the-Loop**: Verdicts with confidence 40–70% set `approvalRequired: true`, triggering a UI approval widget and persistence via `POST /api/session/[id]/approval`

#### 4. Report Generation Agent (`lib/agents/report.ts`)

- **Aggregation**: Groups verdicts by speaker, computes per-speaker accuracy metrics
- **Output**: `Speaker[]` with counts for each verdict category and `accuracyPct = claimsVerified / claimsTotal × 100`
- **Deterministic**: No LLM call; pure computation over verdict results

### Graph Routing Logic

```typescript
// After extraction: skip verification if no claims found
routeAfterExtract: claims.length > 0 ? 'verify_claim' : 'generate_report'

// After each claim: loop back or proceed to report
routeAfterNext: currentClaimIndex < claims.length ? 'verify_claim' : 'generate_report'
```

### Observability

Every agent function is wrapped with `langsmith/traceable`:
```typescript
export const extractClaims = traceable(extractClaimsImpl, {
  name: 'veritas:claim-extraction',
  project_name: 'veritas',
})
```
This enables full trace visualization in LangSmith with latency, token usage, and call hierarchy per claim.

---

## NLP Components

### 1. Claim Detector (`lib/nlp/claim-detector.ts`)

A **fast heuristic classifier** (no LLM call) that pre-filters sentences into opinion vs. fact:

- **Opinion markers**: "I think", "I believe", "in my opinion", "probably", "maybe", etc.
- **Future markers**: "will be", "going to", "won't", "shall"
- **Specificity signals** (regex):
  - Numeric patterns: `\d+(\.\d+)?\s*(%|percent|million|billion|trillion|thousand)`
  - Temporal references: `\b(in|since|before|after)\s+\d{4}`
  - Unit measurements: `\d+(\.\d+)?\s*(degrees?|°c|°f|km|miles|years?)`
- **Fallback**: Sentences ≥6 words without opinion/future markers are considered checkworthy

### 2. Natural Language Inference (`lib/nlp/nli.ts`)

Classifies the relationship between a claim and a piece of evidence:

- **LLM-driven**: Prompts Gemini to return `{stance, credibilityScore, rationale}` as structured JSON
- **Credibility scoring rubric**:
  - 90–100: Government / academic primary sources (BLS, Fed, IPCC, peer-reviewed)
  - 70–89: Major reputable news outlets and fact-checking organizations
  - 50–69: General news / opinion-mixed sources
  - 0–49: Low-quality or unknown sources
- **Heuristic fallback** (when LLM unavailable):
  - Token overlap analysis between claim and evidence
  - Negation detection ("not", "no", "never", "false", "incorrect")
  - If overlap ≥ max(2, ⌊tokens/3⌋) → SUPPORTS/CONTRADICTS based on negation presence
  - Default credibility: 55

### 3. Query Reformulator (`lib/nlp/query-reformulator.ts`)

Generates refined search queries for subsequent ReAct iterations:

- **Input**: Original claim text + previous evidence (up to 4 items with stance + source + excerpt)
- **Output**: Single 3–8 word search query
- **LLM prompt**: Instructs the model to analyze evidence gaps and produce a targeted query
- **Fallback**: Returns original claim text on failure

---

## Retrieval-Augmented Generation (RAG)

### Multi-Source Retrieval Strategy

The system queries **three sources in parallel** for each claim:

#### Tavily Search (`lib/retrieval/tavily.ts`)
- **API**: Tavily web search with `searchDepth: 'basic'`, up to 5 results per query
- **Retry logic**: `withRetry` wrapper with max 2 retries and exponential backoff (200ms → 400ms → 800ms, cap 2s)
- **Graceful degradation**: Returns `[]` on API key missing or exhausted retries

#### Wikipedia (`lib/retrieval/wikipedia.ts`)
- **Two-phase lookup**:
  1. **Direct summary**: `GET /api/rest_v1/page/summary/{title}` — returns if non-disambiguation article exists
  2. **Search fallback**: `GET /w/api.php?action=query&list=search` → fetch top result's summary
- **Scoring**: Direct hits score 0.9, search hits score 0.8
- **Retry logic**: `withRetry` with 2 retries; 404s short-circuit (don't burn retries)

#### PolitiFact RSS (`lib/retrieval/politifact.ts`)
- **Feed**: Parses `https://www.politifact.com/rss/rulings/` via `rss-parser`
- **Caching**: In-memory cache with 15-minute TTL; stale cache served on fetch failure
- **Matching**: Token-based overlap scoring with stopword filtering (∩ of claim tokens vs. feed item title + snippet)
- **Top-K**: Returns up to 3 matching items, sorted by overlap score

### Document Compression (`lib/retrieval/compress.ts`)

Reduces retrieved documents to claim-relevant summaries:

- **Short-circuit**: Documents under 500 words are returned as-is
- **LLM compression**: Prompts Gemini to summarize to 200–300 words, keeping only claim-relevant information (max 8000 chars input)
- **Heuristic fallback**: When LLM unavailable:
  - Splits document into sentences
  - Scores each sentence by token overlap with claim
  - Selects top 6 sentences by relevance score
  - Caps at 2000 characters

---

## LLM Strategy & Resilience

### ResilientLLM (`lib/agents/llm.ts`)

A custom **failover wrapper** implementing a unified `LLM` interface:

```typescript
interface LLM {
  invoke(prompt: string): Promise<{ content: unknown }>
}
```

**Primary**: Gemini 2.0 Flash (`@langchain/google-genai`)
- Temperature: 0.1 (near-deterministic)
- Max output tokens: 2048
- Free tier: 1M tokens/day

**Fallback**: Groq Llama 3.3 70B Versatile (`@langchain/groq`)
- Lazy-loaded only on Gemini failure
- Same temperature/token settings
- Free tier available

**Failover logic**:
1. Try Gemini; on success → return result
2. On quota/rate-limit errors (checks for: `quota`, `rate limit`, `rate_limit`, `resource_exhausted`, `429`, `too many requests`) → mark Gemini blocked for this instance
3. Lazy-import and instantiate Groq; all subsequent calls go directly to Groq
4. If Groq also unavailable → throw descriptive error

**Design pattern**: Once Gemini fails for a given `ResilientLLM` instance, it stays on Groq to avoid latency on guaranteed-failing requests. This is an instance-level circuit breaker.

---

## Transcription & Speaker Diarization

### AssemblyAI Integration (`lib/transcription/assemblyai.ts`)

- **File validation**: Checks size (≤100MB) and extension (mp3, mp4, wav, m4a, webm, ogg, flac)
- **Upload**: `client.files.upload(buffer)` → returns URL
- **Job submission**: `client.transcripts.submit({ audio: url, speaker_labels: true })`
- **Polling**: Up to 150 attempts with 2s intervals (~5 min timeout)
- **Speaker normalization**: Maps AssemblyAI's arbitrary speaker labels to normalized `A`, `B`, `C`, ... using a persistent `Map`
- **Output**: `TranscriptLine[]` with `speaker`, `text`, `timestamp` (formatted `M:SS`), `startMs`, `endMs`

### Web Speech API (`lib/transcription/web-speech.ts`)

- **Browser-side**: Types and utilities for the Web Speech API recognition results
- **Speaker detection**: Parses `"Speaker A: text"` / `"A: text"` patterns from text input
- **Timestamp estimation**: Estimates `endMs` from word count at 150 WPM

---

## Streaming Architecture (SSE)

### Server-Sent Events (`lib/utils/stream.ts`)

Custom `ReadableStream<Uint8Array>` implementation for SSE:

```typescript
interface SSEStream {
  stream: ReadableStream<Uint8Array>
  send: (event: StreamEvent) => void  // JSON-encodes and enqueues
  close: () => void                    // Closes the stream
  isClosed: () => boolean
}
```

### Event Types (`lib/types/index.ts`)

| Event Type          | Payload                                           | Description                                    |
|---------------------|---------------------------------------------------|------------------------------------------------|
| `stage`             | `{ stage: PipelineStage }`                        | Pipeline stage transition                      |
| `transcript_line`   | `{ line: TranscriptLine }`                        | New transcript line available                  |
| `claim_detected`    | `{ claim: ExtractedClaim }`                       | Claim extracted from transcript                |
| `verifying`         | `{ claimId, query, iteration }`                   | ReAct iteration progress                       |
| `verdict`           | `{ verdict: Verdict }`                            | Verdict for a single claim                     |
| `speaker_update`    | `{ speaker: Speaker }`                            | Updated speaker statistics                     |
| `approval_required` | `{ verdictId, claimText, confidencePct }`         | Human review needed (confidence 40–70%)        |
| `complete`          | `{ sessionId }`                                   | Pipeline finished                              |
| `error`             | `{ message }`                                     | Error occurred                                 |

### Client-Side Consumption (`components/app/AppShell.tsx`)

The client reads SSE via `ReadableStream.getReader()`, buffering chunks on `\n\n` boundaries, parsing each `data:` line as JSON, and dispatching to React state handlers. Supports `AbortController` for cancellation.

---

## API Reference

| Method | Endpoint                        | Description                                     | Rate Limit |
|--------|----------------------------------|-------------------------------------------------|------------|
| POST   | `/api/pipeline`                  | Full claim→verdict pipeline; returns SSE stream | 10/min/IP  |
| POST   | `/api/transcribe`                | Multipart file upload → AssemblyAI transcription| —          |
| POST   | `/api/session`                   | Create new session                              | —          |
| GET    | `/api/session/[id]`              | Fetch session by ID                             | —          |
| POST   | `/api/session/[id]/approval`     | Persist verdict approval decision               | —          |
| GET    | `/api/session/[id]/report`       | HTML report (printable to PDF)                  | —          |
| GET    | `/api/health`                    | Health check (Gemini, Tavily, AssemblyAI, Supabase) | —      |

> `/api/health` invokes the real upstream APIs (Gemini, Tavily, AssemblyAI, Supabase) on every call — each healthcheck spends quota and round-trip latency. If you wire it into a heartbeat / uptime monitor, cache externally rather than polling it frequently.

### Pipeline Route Details (`/api/pipeline`)

- **Runtime**: Node.js (not Edge — required for AssemblyAI and LangSmith dependencies)
- **Max Duration**: 60 seconds (Vercel function timeout)
- **Request Body**: `{ sessionId?, transcriptLines: TranscriptLine[], inputMode: 'mic'|'file'|'text' }`
- **Response**: `text/event-stream` with `Cache-Control: no-cache`, `X-Accel-Buffering: no`
- **Abort handling**: Listens to `req.signal` abort and propagates to pipeline loop
- **Rate limiting**: In-memory sliding window, 10 requests/min per client IP, returns 429 with `Retry-After` header

---

## Data Schema & Session Management

### Supabase Schema (`lib/db/schema.sql`)

```sql
create table sessions (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz default now(),
  input_mode      text not null check (input_mode in ('mic','file','text')),
  stage           text not null default 'idle',
  error           text,
  raw_transcript  jsonb default '[]',
  claims          jsonb default '[]',
  verdicts        jsonb default '[]',
  speakers        jsonb default '[]'
);
```

### Dual Storage Strategy (`lib/db/sessions.ts`)

- **Supabase**: Used when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured
- **In-memory `Map`**: Automatic fallback for development/demo mode — zero configuration needed
- **Operations**: `createSession`, `getSession`, `updateSession`, `setVerdictApproval`
- **Error types**: `SessionNotFoundError`, `SessionStorageError` for typed error handling

---

## Frontend Application

### Component Architecture

```
AppShell (state manager)
├── Header (logo, status badge, RUN DEMO / STOP / RUN AGAIN buttons)
├── InputSection (tab switcher: mic / file / text)
│   ├── MicInput (Web Speech API + waveform visualization)
│   ├── FileInput (drag-drop audio/video upload)
│   └── TextInput (textarea with speaker prefix parsing)
├── PipelineBar (6-stage animated progress indicator)
├── TranscriptFeed (speaker-labeled lines with inline claim detection markers)
├── VerdictFeed (verdict cards with confidence bars + approval widget)
├── SpeakerScores (per-speaker accuracy grid)
└── ExportButton (opens HTML report in new tab for print-to-PDF)
```

### Demo Mode

- **Zero external calls**: Uses hardcoded data from `components/app/demoData.ts`
- **Simulated latency**: Progressive delays (600ms–1700ms) to mimic real pipeline behavior
- **Abort support**: Demo loop checks `token.aborted` at every delay checkpoint
- **Sample claims**: US unemployment rate, CPI inflation, Apple market cap, global temperature rise

---

## Tech Stack

| Layer                  | Technology                              | Purpose                                    |
|------------------------|-----------------------------------------|--------------------------------------------|
| Framework              | Next.js 14.2 (App Router)              | Full-stack React framework                 |
| Language               | TypeScript 5                            | Type safety across client and server       |
| Agent Orchestration    | `@langchain/langgraph`                 | State machine for multi-agent pipeline     |
| LLM (Primary)         | Gemini 2.0 Flash (`@langchain/google-genai`) | Claim extraction, NLI, verdict synthesis  |
| LLM (Fallback)        | Groq Llama 3.3 70B (`@langchain/groq`) | Automatic failover on quota exhaustion     |
| Web Search             | Tavily (`@tavily/core`)                | Open-domain web retrieval                  |
| Transcription          | AssemblyAI                              | File upload ASR + speaker diarization      |
| Browser ASR            | Web Speech API                          | Live microphone transcription              |
| Fact-Check Source      | PolitiFact RSS                          | Domain-specific fact-check corpus          |
| Knowledge Base         | Wikipedia REST API                      | Encyclopedic reference                     |
| Database               | Supabase (PostgreSQL)                   | Session persistence (optional)             |
| Observability          | LangSmith                               | Trace visualization per agent call         |
| Streaming              | Native SSE (ReadableStream)             | Real-time pipeline progress to client      |
| Styling                | CSS Variables + Tailwind 3              | Editorial Brutalist design system          |
| Deployment             | Vercel (free tier)                      | Serverless hosting                         |
| Package Manager        | pnpm                                    | Fast, disk-efficient package management    |

---

## Environment Variables

Create `.env.local` at the project root:

| Variable                          | Required for Live | Purpose                                    |
|-----------------------------------|-------------------|--------------------------------------------|
| `GOOGLE_GENERATIVE_AI_API_KEY`    | Yes               | Gemini 2.0 Flash (free 1M tokens/day)      |
| `GROQ_API_KEY`                    | No (fallback)     | Groq Llama 3.3 fallback                    |
| `TAVILY_API_KEY`                  | Yes               | Web search (1000 free/month)               |
| `ASSEMBLYAI_API_KEY`              | For file upload   | ASR + speaker diarization                  |
| `NEXT_PUBLIC_SUPABASE_URL`        | No                | Supabase project URL                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | No                | Supabase client key                        |
| `SUPABASE_SERVICE_ROLE_KEY`       | No                | Supabase server key                        |
| `LANGCHAIN_API_KEY`               | No                | LangSmith tracing (5000 traces/month free) |
| `LANGCHAIN_TRACING_V2`           | No                | Set to `true` to enable tracing            |
| `LANGCHAIN_PROJECT`               | No                | Set to `veritas`                           |
| `NEXT_PUBLIC_APP_URL`             | No                | App public URL                             |

**Demo mode works with zero environment variables.** Live pipeline requires at minimum `GOOGLE_GENERATIVE_AI_API_KEY` + `TAVILY_API_KEY`.

---

## Getting Started

```bash
# Clone and install
cd veritas
pnpm install

# Configure environment (optional for demo mode)
cp .env.example .env.local
# Fill in API keys

# Run development server
pnpm dev
# → http://localhost:3000

# Type-check
pnpm tsc --noEmit

# Lint
pnpm lint

# Production build
pnpm build
pnpm start
```

### Production caveats

- **Vercel function timeout (60s).** `/api/pipeline` is configured with `maxDuration = 60`, which is a hard ceiling on Vercel's free / Hobby tier. With Gemini-only LLM calls and the per-claim cap of 6 retrieved docs, expect a practical capacity of **~6 claims per pipeline run** before the function times out. Transcripts that yield more than that many checkworthy lines should be split or trimmed client-side; otherwise later claims will be cut off mid-stream.
- **In-memory rate limit and session store are per-instance.** The sliding-window limiter (`lib/utils/rate-limit.ts`) and the in-memory `Map` fallback in `lib/db/sessions.ts` live inside one serverless function process. Vercel scales horizontally, so a request that hits a different instance will see no prior state — the limiter under-counts and `getSession` returns null on the wrong instance. For live deployments, configure Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Without it, the approval flow and the `/api/session/[id]/report` export are unreliable across instances.
- **Env requirements differ by mode.** Demo mode (`runDemo` in `AppShell.tsx`) is fully offline and needs zero env vars. The live pipeline requires at minimum `GOOGLE_GENERATIVE_AI_API_KEY` and `TAVILY_API_KEY`. `GROQ_API_KEY` enables automatic fallback when the Gemini free-tier quota is exhausted. `ASSEMBLYAI_API_KEY` is required for file-upload transcription. Supabase keys + LangSmith are optional but recommended in production.
- **Approval flow requires Supabase in production.** Without it, approval POSTs may return 404 when they hit a different serverless instance than the one that owns the in-memory session. Configure Supabase, or run on a single long-lived process.

## Deploying to Vercel

1. Push the repo to GitHub.
2. Import the project on vercel.com. Set the framework preset to "Next.js"; root is `veritas/`.
3. Add the env vars listed in **Production caveats** above (at minimum the two pipeline keys).
4. Deploy. The `maxDuration = 60` declaration in `app/api/pipeline/route.ts` opts the route into the longer execution budget; no further config is needed.
5. If you want sessions / approval persistence across instances, run `lib/db/schema.sql` in your Supabase project and add the three Supabase env vars.

---

## Key Highlights for ML Engineers

### 1. Multi-Agent State Machine (LangGraph)

The pipeline is not a simple chain — it's a **compiled LangGraph state machine** with conditional edges, typed state annotations, and custom reducers. The graph handles dynamic routing: if claim extraction returns zero claims, it short-circuits directly to report generation. The verify→verdict→next_claim loop processes claims sequentially, accumulating verdicts via an append reducer.

### 2. ReAct (Reasoning + Acting) Verification Loop

The verification agent implements a **bounded ReAct loop** (max 3 iterations) that is the core ML contribution:
- **Reasoning**: Evaluates evidence sufficiency after each retrieval round
- **Acting**: Reformulates search queries based on evidence gaps
- **Termination**: Early exit when evidence is conclusive (≥2 supporting or ≥1 contradicting credible source)
- This mirrors the ReAct paradigm from [Yao et al., 2022](https://arxiv.org/abs/2210.03629), applied to fact-checking

### 3. Open-Domain Web RAG (No Static Corpus)

Unlike systems that rely on pre-indexed document stores (FAISS, Pinecone, ChromaDB), Veritas performs **live open-domain retrieval** against the web at inference time. This eliminates corpus staleness but introduces latency and reliability challenges, addressed via:
- Parallel multi-source retrieval (Tavily + Wikipedia + PolitiFact)
- Retry with exponential backoff
- Heuristic fallbacks at every LLM call site

### 4. NLI-Based Evidence Classification

Each retrieved document is classified via **Natural Language Inference** (SUPPORTS / CONTRADICTS / NEUTRAL) with per-source credibility scoring. The NLI module uses an LLM-as-a-classifier approach with a structured rubric for credibility tiers (government/academic → news → general → unknown). A token-overlap + negation-detection heuristic provides a zero-LLM fallback.

### 5. LLM Resilience Architecture

The `ResilientLLM` class implements an **instance-level circuit breaker** pattern:
- Detects quota/rate-limit errors across multiple error message formats
- Switches to fallback model (Groq Llama 3.3 70B) and stays there for the instance lifetime
- Unified `LLM` interface means all downstream consumers (claim extraction, NLI, verdict synthesis, document compression, query reformulation) get automatic failover with zero code changes

### 6. Dual-Layer Fallback Strategy

Every LLM-dependent function has a **heuristic fallback path**:
- **NLI**: Token overlap + negation detection
- **Document compression**: Sentence scoring by claim-token overlap
- **Verdict synthesis**: Rule-based label assignment from evidence statistics
- **Query reformulation**: Returns original claim text
- **Claim extraction**: Returns empty array (graceful degradation)

This ensures the system degrades gracefully under LLM failures rather than crashing.

### 7. Per-Speaker Attribution & Accountability

Speaker diarization (via AssemblyAI) is propagated through the entire pipeline. Each claim, verdict, and accuracy score is **attributed to a specific speaker**, enabling per-speaker trust scoring — a feature uncommon in existing fact-checking tools.

### 8. Human-in-the-Loop for Uncertain Verdicts

Verdicts with confidence 40–70% are flagged with `approvalRequired: true`. The frontend renders an approval widget, and decisions are persisted to the session store via a dedicated API endpoint. This implements a **calibrated human-in-the-loop** system where only uncertain predictions are escalated.

### 9. Structured Output Extraction with Robustness

The LLM outputs are parsed with multiple fallback strategies:
- Primary: `JSON.parse(response)`
- Fallback 1: Strip markdown code fences
- Fallback 2: Regex extraction of JSON array `\[[\s\S]*\]`
- Fallback 3: Heuristic defaults

This handles the inherent unreliability of LLM-generated structured output without using constrained decoding.

### 10. End-to-End Observability via LangSmith

All four agent functions are wrapped with `langsmith/traceable`, enabling:
- Full call hierarchy visualization per pipeline run
- Token usage tracking across Gemini and Groq
- Latency breakdown per agent node
- Evidence retrieval and NLI classification traces
- Project-scoped traces under `project_name: 'veritas'`

### 11. Cost Architecture: $0/Month

| Service      | Free Tier                    | Veritas Usage                  |
|--------------|------------------------------|--------------------------------|
| Gemini       | 1M tokens/day                | ~2K tokens/claim × N claims    |
| Groq         | Free tier (rate-limited)     | Fallback only                  |
| Tavily       | 1000 searches/month          | 1–3 searches/claim             |
| AssemblyAI   | Free tier hours              | On-demand file transcription   |
| Supabase     | 500MB + 50K rows             | Session storage                |
| Vercel       | 100GB bandwidth, 100h compute| Serverless deployment          |
| LangSmith    | 5000 traces/month            | 1 trace/agent call             |

### 12. Production Reliability Patterns

- **Rate limiting**: In-memory sliding window, 10 req/min per client IP
- **Retry with backoff**: Exponential backoff (200ms base, 2s cap) on retrieval failures
- **Abort propagation**: `AbortController` signal propagates from client through SSE to pipeline loop
- **Non-fatal session updates**: Pipeline continues even if session persistence fails
- **PolitiFact cache**: 15-minute TTL with stale-on-error semantics
