# Veritas — Phase 0 Audit

## Honest disclosures (added 2026-06-08)

Two authored modules are present and tested but **not wired into the
runtime path**. Kept in-tree as decision artifacts rather than deleted:

- `lib/agents/adversarial.ts` — Phase 4E adversarial-evidence pass.
  Implemented + unit-tested (`eval/test/adversarial.test.ts`). Not
  invoked by `lib/agents/graph.ts`. Wire in by adding a node after
  `synthesise_verdict` that calls `adversarialReview(verdict, query, model)`
  on `VERIFIED` verdicts.
- `lib/report/formats.ts` — JSON + Markdown report exporters
  (`renderReportJson`, `renderReportMarkdown`). Unit-tested. Not exposed
  in `ExportButton.tsx` (HTML only). Wire in by adding format-picker
  buttons + `Content-Type`-aware download links.

---

## Read-Through Date: 2026-05-31

Source of truth for Phases 1–7. Every line below was verified against the
actual code at the time of writing (file:line citations throughout).

---

## 0A — Architecture Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                       CLIENT (Next.js App)                           │
│  app/page.tsx ── Landing (Hero · Problem · Novelties · Pipeline ·    │
│                  Market · ProductCTA · PageTransition)               │
│  app/app/page.tsx ── AppShell (state machine: sessionId, stage,      │
│                  transcriptLines, claims, verdicts, speakers, error) │
│     │                                                                │
│     │ POST /api/session  → returns sessionId                         │
│     │ POST /api/pipeline → SSE stream                                │
│     │ POST /api/transcribe (multipart .docx/.pdf)                    │
│     │ POST /api/transcribe/realtime-token (AssemblyAI mic token)     │
│     │ POST /api/session/[id]/approval                                │
│     │ GET  /api/session/[id]/report                                  │
│     │ GET  /api/health                                               │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                  SERVER (Next.js API Routes)                         │
│                                                                      │
│  app/api/pipeline/route.ts                                           │
│    │ 1. clientKey() reads x-forwarded-for / x-real-ip /              │
│    │      cf-connecting-ip                                           │
│    │ 2. rateLimit(`pipeline:${ip}`, 10, 60s) → 429 on overflow       │
│    │ 3. validateTranscriptLines(body) → 400 on >500 lines,           │
│    │      5000 chars/line, 200000 chars total                        │
│    │ 4. createSession(inputMode) | getSession(sessionId)             │
│    │ 5. createSSEStream() → ReadableStream                           │
│    │ 6. runPipeline() async — never awaited, errors via stream       │
│    │                                                                 │
│    │   runPipeline owns:                                             │
│    │     - setStage() → SSE + persist(stage)                         │
│    │     - createResilientLLM() → Gemini → Groq circuit breaker      │
│    │     - onEvent() switch — forwards graph events to SSE +         │
│    │         persists to Supabase via updateSession(.catch(swallow)) │
│    │                                                                 │
│  lib/agents/graph.ts (LangGraph StateGraph)                          │
│    │ Annotation.Root: transcriptLines, model, onEvent, claims,       │
│    │   currentClaimIndex, searchResults, iterationCount,             │
│    │   currentClaimQueries, verdicts, speakers, stage, error         │
│    │                                                                 │
│    │ Nodes:                                                          │
│    │   extract_claims  ────────► lib/agents/claim-extraction.ts      │
│    │     │                       lib/nlp/claim-detector.ts (filter)  │
│    │     ▼ routeAfterExtract                                         │
│    │   verify_claim    ────────► lib/agents/verification.ts          │
│    │     │                       (ReAct loop, max 3 iter)            │
│    │     │ runs:                                                     │
│    │     │   - gatherParallel(query, onIssue)                        │
│    │     │       Promise.all([searchTavilyWithStatus,                │
│    │     │                    searchWikipediaWithStatus,             │
│    │     │                    searchPolitifact])                     │
│    │     │       onIssue → SSE retrieval_warning                     │
│    │     │   - compressDocument (LLM compression / heuristic)        │
│    │     │   - classifyNli (LLM NLI / token-overlap fallback)        │
│    │     │   - isSufficient (credibility-weighted)                   │
│    │     ▼                                                           │
│    │   synthesise_verdict ─────► lib/agents/verdict.ts               │
│    │     │ approvalRequired = 40 ≤ conf ≤ 70                         │
│    │     ▼                                                           │
│    │   next_claim ── more? ─────► loop back to verify_claim          │
│    │     │ else                                                      │
│    │     ▼                                                           │
│    │   generate_report ────────► lib/agents/report.ts                │
│    │     │ per-speaker aggregation                                   │
│    │     ▼ END                                                       │
│                                                                      │
│  All four agent functions wrapped with langsmith/traceable.          │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                       EXTERNAL SERVICES                              │
│  Gemini 2.0 Flash (primary)  · Groq Llama 3.3 70B (fallback)         │
│  Tavily web search           · Wikipedia REST API                    │
│  PolitiFact RSS (cached 15m) · AssemblyAI (mic streaming token)      │
│  AssemblyAI is NOT used for file upload anymore — that path now      │
│    uses mammoth (.docx) + pdf-parse (.pdf), server-side only.        │
│  Supabase (sessions, jsonb columns) — falls back to in-memory Map.   │
│  LangSmith (traceable wrappers around every agent call)              │
└──────────────────────────────────────────────────────────────────────┘
```

**Where SSE events are emitted**: `app/api/pipeline/route.ts:onEvent`
forwards `GraphEvent` → `StreamEvent` (see `lib/types/index.ts:89`).
The graph emits via `state.onEvent` in every node (`lib/agents/graph.ts`).

**Where Supabase writes happen**: `lib/db/sessions.ts:updateSession` is
the only writer. It is called from `runPipeline.persist` for every
stage transition, claim, verdict, and speaker update — fire-and-forget,
errors logged but never propagated.

**Where LangSmith traces are created**: four `traceable` wrappers:
- `lib/agents/claim-extraction.ts:138` (`veritas:claim-extraction`)
- `lib/agents/verification.ts:188` (`veritas:react-verification`)
- `lib/agents/verdict.ts:207` (`veritas:verdict-synthesis`)
- `lib/agents/report.ts:38` (`veritas:report-generation`)

---

## 0B — Completion Gap Analysis

Cross-referenced against the sprint plan's "What Is Already Implemented" list.
Below is **only** what is missing or incomplete.

### Input Modalities
- [GAP] Mic input has no word-level confidence visualisation (sprint 1A asks
  for opacity per word). Current `MicInput.tsx` shows turn-final text only.
- [GAP] File upload has no per-stage progress bar — currently a single
  "EXTRACTING · %" with a fake-progress timer (`FileInput.tsx:34`).
- [GAP] Scanned PDF handling: `app/api/transcribe/route.ts:53-58` already
  returns a clean 422 with "No extractable text found in the document"
  for empty extraction. **PARTIAL — message could be friendlier.**
- [GAP] Text paste auto-detects speaker turns via `parseTranscriptFromText`
  but only `Speaker X:` / `X:` formats — not `[00:00]`, `>`, `—`, `Name:`.

### Verdict Types & Exports
- [GAP] No `CONTESTED` verdict label. `VerdictLabel` (`lib/types/index.ts:3`)
  is `VERIFIED | FALSE | MISLEADING | UNVERIFIED` only.
- [GAP] No adversarial evidence pass — every verdict accepts first-pass
  evidence without counter-search.
- [GAP] Export formats: only HTML (via `lib/report/render.ts`). Missing
  PDF (via `@react-pdf/renderer`), JSON, and Markdown.
- [GAP] No shareable read-only link path. `/api/session/[id]/report` exists
  but the URL contains the full session id, not a short hash.

### Speaker Workflow
- [GAP] No speaker assignment modal. Speakers are referenced by their
  AssemblyAI label (A, B, C…) throughout — no rename step before
  fact-checking begins.
- [GAP] No per-speaker rolling credibility across sessions. The Supabase
  schema has `speakers` per session but no cross-session aggregate table.

### Claim Extraction
- [GAP] `ExtractedClaim` (`lib/types/index.ts:37`) does not include
  `claim_type`, `entities`, or a separate `confidence` field. The sprint
  asks for these. The current type has `speaker`, `claimText`, `timestamp`,
  `originalText`, `searchQuery`.
- [GAP] No deduplication step — two claims with >85% token overlap from the
  same speaker are kept as separate claims.
- [GAP] No "Low confidence claims" panel in the UI.

### Pipeline Features
- [GAP] No claim verdict cache — every pipeline run re-evaluates from
  scratch even if claim + sources are identical.
- [GAP] No confidence decay / freshness model — verdicts are timeless
  once produced.
- [GAP] No rhetorical pattern detector (`appeal_to_authority`,
  `false_dichotomy`, etc.).
- [GAP] No claim genealogy graph (cross-claim entity links + propagation).

### Frontend UX
- [GAP] No global React error boundary. Render-time exceptions crash the
  whole tree.
- [GAP] No skeleton loaders during pipeline stages (currently a stage
  label only).
- [GAP] No virtual scrolling — long transcripts and claim lists render
  every node.
- [GAP] No `aria-live` regions for streaming verdicts.

### Health & Observability
- [STATUS] `/api/health` exists and returns `{status, services,
  sessionStore, env, latencyMs}`. Sprint 7C wants additional fields:
  `uptime_seconds`, `pipeline: idle|running|error`, `cache: {hits,
  misses, size}`, `external_api_latency_ms: {gemini, tavily,
  assemblyai}`, `claims_processed_session`. **PARTIAL.**

### Security
- [GAP] No HTTP security headers (CSP, X-Frame-Options, etc.). The
  `next.config.mjs` headers function only sets CORS.
- [GAP] No magic-byte MIME validation on uploads — current check is by
  extension and `file.type`.
- [GAP] No startup env-var validation. Missing keys surface as 500s on
  first request.
- [GAP] No prompt-injection anomaly detection on LLM output — only
  input is sanitised.

### Testing
- [STATUS] 23 unit tests in `eval/test/`. Sprint 6A requires expansion
  to graph nodes, verdict adversarial path, NLI classifier, rhetoric,
  retrieval clients, session, decay, genealogy, credibility. **MAJOR
  GAP — most of `lib/` has zero unit coverage.**
- [GAP] No frontend component tests (sprint 6C).
- [GAP] No request-interceptor mock layer for external APIs.

---

## 0C — Security Surface Map

### Already protected via `lib/utils/sanitize.ts`
- `lib/nlp/nli.ts:114` — `classifyNli` wraps `claim`, `evidence`,
  `sourceUrl` in `sanitiseForPrompt` / `sanitiseUrl` / `delimitUntrusted`.
- `lib/agents/verdict.ts:143` — `synthesiseVerdict` wraps `claimText`,
  every `evidence[i].url`, every `evidence[i].excerpt`, every
  `evidence[i].source`.

### NOT yet protected
- `lib/agents/claim-extraction.ts` — `extractClaimsImpl` interpolates
  raw transcript lines into the extraction prompt. Transcript lines
  are user input. **NEEDS sanitisation.**
- `lib/retrieval/compress.ts` — `compressDocument` interpolates raw
  retrieved document content + claim text into the compression prompt.
  Retrieved documents are external untrusted content. **NEEDS sanitisation.**
- `lib/nlp/query-reformulator.ts` — `reformulateQuery` interpolates
  `claim.claimText` and per-evidence text. **NEEDS sanitisation.**
- File upload (`app/api/transcribe/route.ts`): extension and MIME header
  checked but not magic bytes. A `.docx` with PDF magic bytes (or
  vice versa) would crash the extractor unhelpfully.
- No CSP / X-Frame-Options / Referrer-Policy headers.
- No startup validation of required env vars — missing keys 500 at runtime.

---

## 0D — Performance Bottleneck Map

### Already parallel
- `lib/agents/verification.ts:gatherParallel` — Tavily / Wikipedia /
  PolitiFact via `Promise.all`. Verified at line 37.

### Sequential where parallel is possible
- The ReAct loop is per-claim sequential. With 5 claims, the pipeline
  is 5× verification cost. Could pipeline claims after the first (start
  iteration 1 of claim N+1 while claim N is on iteration 2 or higher),
  but this complicates abort semantics. **DECISION: leave sequential.**
- `app/api/health/route.ts:62` already runs the four service checks in
  parallel via `Promise.all`. Good.

### Missing caches
- No claim-verdict cache (LRU by hash of claim text + source URLs).
- PolitiFact has a 15-minute RSS cache; Tavily and Wikipedia do not.

### Unbounded renders
- `components/app/TranscriptFeed.tsx` renders every line — no
  `React.memo`, no virtualisation. Fine up to ~100 lines, problematic
  at 1000.
- `components/app/VerdictFeed.tsx` — same. Each verdict card is a fresh
  render on every state update.

### Bundle
- No bundle analyser configured. No code-splitting beyond Next's
  per-page automatic splits. Heavy components (the report renderer,
  the demo data file at 6 KB) are bundled into the app page even when
  unused.

---

## 0E — Dead Code Inventory

Done in the last session — verified clean:
- `lib/db/browser-client.ts` — DELETED
- `lib/transcription/assemblyai.ts` — DELETED
- `WebSpeechResult` interface — REMOVED
- `searchWikipedia` plain wrapper — REMOVED
- `@google/generative-ai` package — REMOVED from package.json
- `@langchain/community` package — REMOVED from package.json

Remaining notes:
- `lib/transcription/web-speech.ts` filename is historical — kept
  intentionally; renaming would ripple.
- `formatTimestamp`, `splitSentencesPreservingAbbreviations` are exported
  but only used internally — over-exposed, not dead.
- All current imports verified used as of `pnpm test` 23/23 passing
  and `pnpm build` exiting 0 with all 10 routes compiling.

---

## 0F — Test Coverage Gap

Existing 23 tests cover:
- `lib/utils/sanitize.ts` — full
- `lib/utils/rate-limit.ts` — full
- `lib/transcription/web-speech.ts` — partial (`parseTranscriptFromText`,
  not `chunkToTranscriptLine` or `formatTimestamp` directly)

ZERO test coverage on:
- `lib/agents/graph.ts` (the entire state machine)
- `lib/agents/claim-extraction.ts`
- `lib/agents/verification.ts` (the ReAct loop)
- `lib/agents/verdict.ts`
- `lib/agents/report.ts`
- `lib/agents/llm.ts` (the resilient circuit breaker — critical path)
- `lib/nlp/nli.ts`
- `lib/nlp/credibility.ts`
- `lib/nlp/claim-detector.ts`
- `lib/nlp/query-reformulator.ts`
- `lib/retrieval/tavily.ts`
- `lib/retrieval/wikipedia.ts`
- `lib/retrieval/politifact.ts`
- `lib/retrieval/compress.ts`
- `lib/db/sessions.ts`
- `lib/db/client.ts`
- `lib/utils/retry.ts`
- `lib/utils/stream.ts`
- `lib/utils/json.ts` (the four-tier JSON parser — also critical)
- `lib/utils/id.ts`
- `lib/utils/logger.ts`
- `lib/report/render.ts`
- All API routes
- All React components

This is the biggest gap by ratio. Phase 6 expands this.

---

## 0G — Dependency Audit

Current `dependencies` in `package.json` (all exact-pinned):
- `@langchain/core 1.1.40` — peer dep magnet, current
- `@langchain/google-genai 2.1.27` — current
- `@langchain/groq 1.2.0` — current
- `@langchain/langgraph 1.2.9` — current
- `@supabase/supabase-js 2.103.3` — current
- `@tavily/core 0.7.2` — current
- `assemblyai 4.30.0` — current
- `langsmith 0.5.20` — current
- `mammoth 1.12.0` — current
- `next 14.2.35` — current 14.x; 15.x available, breaking changes
- `pdf-parse 2.4.5` — current (v2 modern API)
- `react 18.3.1` — current 18.x; 19.x released but Next 14 has limited
  support
- `react-dom 18.3.1` — matches react
- `rss-parser 3.13.0` — current

DevDeps (all exact-pinned):
- `@types/node 20.14.10` · `@types/react 18.3.3` · `@types/react-dom 18.3.0`
- `eslint 8.57.0` · `eslint-config-next 14.2.35`
- `postcss 8.4.39` · `tailwindcss 3.4.1`
- `tsx 4.22.0` · `typescript 5.5.3`

No `^` or `~` ranges anywhere. Confirmed via:
```
node -e "const p=require('./package.json'); console.log(Object.entries({...p.dependencies,...p.devDependencies}).filter(([,v])=>v.startsWith('^')||v.startsWith('~')))"
→ []
```

### Items to add for Phase 4 / Phase 6
- LRU cache (likely `lru-cache@10` — keep small)
- For React tests if Phase 6C frontend tests added: `@testing-library/react`
  + `jsdom`. **DECISION: skip for now — Node `node:test` doesn't have a
  React renderer; pulling JSDOM is a big addition. Phase 6 will cover
  unit/integration tests of the agent layer, which is where bugs hide.**

### Tailwind status
- `tailwindcss 3.4.1` is in devDeps and `app/globals.css` has the three
  `@tailwind` directives — but NO Tailwind utility class is consumed
  anywhere in `components/` or `app/`. Decision per previous sessions:
  leave installed; styling stays inline + CSS variables.

---

## Audit closed.
Phases 1–7 reference this file. Findings drive Phase 1 (gaps), Phase 2
(security), Phase 3 (perf), Phase 4 (novelties), Phase 6 (tests).
