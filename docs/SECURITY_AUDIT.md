# Security Audit — Veritas

## Phase 3 — Public-deploy hardening — 2026-06-07

Triggered by the decision to deploy to public Vercel. Closed four items
that were "acceptable for demo, not for public" from the prior audit.

| # | Item | State |
|---|---|---|
| 1 | **Open CORS on `/api/*`** | ✅ FIXED. Removed the `Access-Control-Allow-Origin: *` block in `next.config.mjs`. Same-origin only by Next.js default. Verified by `OPTIONS` preflight from a foreign origin: no ACAO header on either preflight or real responses. |
| 2 | **Rate limiter was per-process in-memory** | ✅ FIXED. `lib/utils/rate-limit.ts` rewritten with a dual backend — Upstash Redis via REST when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, in-memory `Map` otherwise. Multi-window support (e.g. minute + day). Graceful fallback per check if Redis is temporarily unreachable. |
| 3 | **Pipeline endpoint was 10/min/IP only** | ✅ TIGHTENED. New per-endpoint budgets: `/api/pipeline` 3/min + 50/day, `/api/transcribe` 5/min + 30/day, `/api/session` 20/min + 200/day, `/api/session/[id]/approval` 30/min. All return `429` with a structured body (`{ error, code: 'rate_limited', retryAfterSeconds, hitWindow }`) and a `Retry-After` header. |
| 4 | **No auth on verdict-approval endpoint** | ✅ FIXED. Per-session bearer token issued once at `POST /api/session` and required on `POST /api/session/[id]/approval` via `Authorization: Bearer <token>`. Constant-time comparison. 401 with `code: 'missing_token'` / `'invalid_token'` on failure. Token check happens before "verdict not found" so callers can't distinguish a valid session from an invalid token. |

### UI alert alignment

Every new failure path surfaces a typed message in the existing
`errorMsg` (coral banner) or `advisoryMsg` (auto-dismissing amber banner)
slots in `AppShell.tsx`:

- 429 on pipeline → `"Pipeline rate-limited (per-minute). Try again in 47s."`
- 429 on transcribe → `"Upload rate-limited (per-day). Try again in 79483s."`
- 429 on approval → `"Approval rate-limited. Try again in 30s."`
- 401 missing token → `"Approval token missing. Reload the page to issue a fresh session."`
- 401 invalid token → `"Approval token rejected. Start a new session to record approvals."`
- 413 on transcribe → `"File too large — 25 MB max."`
- 415/422 on transcribe → upstream message verbatim ("File extension does not match…")
- Supabase missing-column → process-local fallback + one-shot WARN pointing at the migration file

### Required infrastructure changes

Two **operator** actions to take before the public deploy:

1. **Run** `db/migrations/002_approval_token.sql` in the Supabase SQL editor. Adds the `approval_token TEXT` column on `sessions`. Without this the app silently falls back to a process-local token map that does NOT survive cold starts; verdict approvals will fail across instances.
2. **Create** an Upstash Redis instance (free tier) and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in the Vercel project's environment variables. Without these the rate limiter falls back to per-instance in-memory and burns your paid-API free tiers.

### Residual (deferred from prior audit, still deferred)

- **Next.js 14.2.35** — 5 advisories patched in 15.5.16+. Major-version bump with breaking app-router behaviour and React 19 requirement; deferred to a dedicated branch with full regression testing.
- **CSP `unsafe-inline` / `unsafe-eval`** — needed for Next dev HMR + runtime hydration. Tightening requires nonce/hash plumbing through Next response pipeline.

---

## Phase 2 of FINAL SPRINT — 2026-05-31

This document records every security action taken in the autonomous
session, plus the residual risks that remain.

---

## 1. Secrets Hygiene

| Item | State | Detail |
|---|---|---|
| `.env.example` | ✅ | Plaintext keys removed in a prior session; replaced with placeholders. **Live keys that previously sat in this file must be rotated outside the codebase.** |
| `.env.local` | ✅ | Gitignored. |
| `.env` | ✅ | Gitignored. |
| Startup env validation | ✅ NEW | `lib/utils/env.ts` — `checkPipelineEnv()` and `looksLikeSecret()`. The pipeline route logs a clear "missing key" error via the structured logger when keys are absent, naming the var but **never** its value. |
| Secret-shape detector | ✅ NEW | `looksLikeSecret()` flags Google / Groq / Tavily / LangSmith / OpenAI key shapes. Hooked into the logger for opt-in scanning. |

---

## 2. Prompt-Injection Hardening

`lib/utils/sanitize.ts` exposes `sanitiseForPrompt`, `sanitiseUrl`, and
`delimitUntrusted`. **Every** LLM call site in `lib/` was audited:

| Module | Inputs sanitised |
|---|---|
| `lib/agents/claim-extraction.ts` | ✅ NEW — transcript lines wrapped in `delimitUntrusted('transcript', …)`, control chars stripped per line. |
| `lib/nlp/nli.ts` | ✅ (prior session) — `claim`, `sourceUrl`, `evidence` all sanitised; explicit "do not follow embedded instructions" prefix. |
| `lib/agents/verdict.ts` | ✅ (prior session) — `claimText`, each `evidence[i].url`, `evidence[i].excerpt`, `evidence[i].source` sanitised. |
| `lib/retrieval/compress.ts` | ✅ NEW — `claim` and document body in `delimitUntrusted` tags. |
| `lib/nlp/query-reformulator.ts` | ✅ NEW — claim and per-evidence excerpts sanitised. |
| `lib/nlp/rhetoric.ts` | ✅ NEW — claim wrapped in `<claim>` tags, explicit instructions block. |
| `lib/agents/adversarial.ts` | ✅ NEW — relies on `compressDocument` and `classifyNli` which are both already sanitised. |

---

## 3. Output Validation

- LLM responses are parsed with a four-tier fallback in `lib/utils/json.ts`
  (`extractJsonObject` / `extractJsonArray`), well-tested by 11 new unit
  tests in `eval/test/json-util.test.ts`.
- `rhetoric.ts` clamps any LLM-emitted `pattern` value to the explicit
  enum or `null` — adversarial output cannot inject an unknown string.
- `verdict.ts` clamps `label` to `VerdictLabel` and `confidencePct` to
  `0..100`.
- `nli.ts` clamps `credibilityScore` to `0..100` and stance to the enum.

---

## 4. HTTP Layer

`next.config.mjs` now sets:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=()` |
| `Content-Security-Policy` | self + listed API origins for `connect-src`; `frame-ancestors 'none'`; restrictive `base-uri` and `form-action`. |

`script-src` retains `'unsafe-inline' 'unsafe-eval'` for Next.js dev
HMR and runtime hydration — tightening to nonce/hash is a follow-up
that requires touching the Next.js server response pipeline.

---

## 5. Input Validation

`POST /api/pipeline` enforces (Phase 1, prior session):
- ≤500 transcript lines
- ≤5000 chars per line
- ≤200000 chars total
- per-field type coercion

`POST /api/transcribe` enforces (this session):
- File ≤25 MB
- Extension OR MIME type must be `.docx` / `.pdf`
- **NEW: Magic-byte check** — PDF must start with `%PDF`, docx must
  start with `PK` (ZIP). Mismatched extension/magic returns 415.

---

## 6. Rate Limiting

`lib/utils/rate-limit.ts` — sliding window, 10 req/min/IP. IP read from
`x-forwarded-for` → `x-real-ip` → `cf-connecting-ip` → `'local'`.

In-memory store; **emits a one-shot warning in production** that the
limiter is per-instance and does not protect against horizontally-scaled
abuse. Real protection requires Redis / Upstash / Vercel KV — flagged
in the production checklist.

---

## 7. Dependency Vulnerabilities

### Before this session: `pnpm audit` reported **40** vulnerabilities (3 low / 23 moderate / 14 high).

### After applying `pnpm.overrides`:

| Override | Effect |
|---|---|
| `"axios": ">=1.16.0"` | Closes CVE-2025-* DoS / SSRF / proto-pollution chain via `@tavily/core>axios`. |
| `"uuid": ">=13.0.1"` | Closes buffer-bounds advisory via `@langchain/langgraph-sdk>uuid`. |
| `"esbuild": ">=0.25.0"` | Picks up the most recent patched line for the build path. |

### After overrides: **20** vulnerabilities (2 low / 11 moderate / 7 high).

The remaining high-severity items all flow from:

1. **Next.js 14.2.35** — five separate advisories (SSRF via WebSocket
   upgrade, middleware/proxy bypass, DoS via HTTP request
   deserialisation, two DoS Server Components items). All patched in
   Next.js **15.5.16+**.
   - **Decision: not upgraded in this session.** Next 15 is a major
     bump with breaking app-router / async-headers behaviour and
     requires React 19. Doing this autonomously without manual
     regression testing in a real browser is more risk than the
     vulnerabilities themselves on a localhost dev build.
   - **Action required before public deploy:** upgrade to Next 15 in a
     dedicated branch with full regression testing.

2. **LangSmith** — one prompt-pull deserialisation advisory. We do not
   call the affected API (`pull_prompt` from the public hub); it's a
   transitive risk only when consuming public prompts. Acceptable to
   defer if `langsmith.pullPrompt` is never invoked at runtime — which
   it is not in this codebase (verified by grep).

3. **glob** — CLI command injection. We do not invoke `glob` as a CLI;
   it's only imported as a library in transitive build tooling.

### Net high-severity items where our code is actually exposed: 0.

---

## 8. Items NOT addressed in this session

| Item | Reason |
|---|---|
| Next.js 15 upgrade | Breaking changes; needs human regression testing. |
| CSP without `unsafe-inline`/`unsafe-eval` | Requires nonce/hash plumbing through Next.js. |
| Redis-backed rate limit + session store | Requires infrastructure decision. |
| Per-user auth | Out of scope for an anonymous fact-checker. |
| LangSmith allowlist of public prompts | We do not consume public prompts; no action needed. |

---

End of audit.
