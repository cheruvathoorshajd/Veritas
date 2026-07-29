# Veritas — Deployment & Hardening Guide

This walks through every gap that currently stops Veritas from being a polished, production-grade deploy. Items are ordered by what unblocks what — work top-down. Anything marked **(required)** must be done for the live pipeline to function; everything else improves robustness or polish.

---

## 1. Obtain API keys (required)

The live pipeline needs three keys; two more are strongly recommended.

### 1a. Google Generative AI (Gemini) — required

1. Visit https://aistudio.google.com/app/apikey
2. Sign in with a Google account.
3. Click **Create API key** and copy the value (`AIza...`).
4. Free tier: 1M tokens/day, 15 requests/minute. Sufficient for a portfolio demo; not for traffic.

### 1b. Tavily Search — required

1. Visit https://app.tavily.com/home
2. Sign up; the dashboard shows your API key on the home page (`tvly-...`).
3. Free tier: 1,000 searches/month. Each fact-check claim uses ~1-3 searches.

### 1c. AssemblyAI — required for file-upload transcription

1. Visit https://www.assemblyai.com/app/account
2. Sign up; the API key is shown on the dashboard.
3. Free tier: 100 hours of transcription. Required for `/api/transcribe`; the demo and text-input paths don't need it.

### 1d. Groq — recommended (Gemini fallback)

1. Visit https://console.groq.com/keys
2. Sign in with Google/GitHub; click **Create API Key**.
3. Free tier is fast and generous (Llama 3.3 70B). The `ResilientLLM` wrapper in `lib/agents/llm.ts` falls back to Groq automatically when Gemini hits a quota or rate-limit error.

### 1e. LangSmith — recommended (observability)

1. Visit https://smith.langchain.com/settings
2. Sign up; under **API Keys** click **Create API Key**.
3. With this key set, every `traceable`-wrapped agent call (claim extraction, verification, verdict synthesis, report generation) appears as a trace in the `veritas` project — invaluable for debugging.

---

## 2. Improve `.env.example` so the next contributor isn't guessing

The current `.env.example` lists key names but no formatting hints. Replace with:

```dotenv
# AI / LLM (1a — required)
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...your-gemini-key
# AI / LLM fallback (1d — recommended; auto-used on Gemini quota errors)
GROQ_API_KEY=gsk_...your-groq-key

# Search / Retrieval (1b — required)
TAVILY_API_KEY=tvly-...your-tavily-key

# Transcription + Diarization (1c — required for /api/transcribe)
ASSEMBLYAI_API_KEY=your-assemblyai-key

# Database (3 — required for cross-instance approval/report persistence)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...anon-jwt
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-jwt

# Observability (1e — recommended)
LANGCHAIN_API_KEY=lsv2_...your-langsmith-key
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=veritas

# App (10 — set to your Vercel domain in production)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For local development, copy this file to `.env.local`, paste the real keys, and `pnpm dev` will pick them up automatically.

---

## 3. Set up Supabase (recommended for production)

Without Supabase, sessions and approval decisions live in a per-instance `Map` that doesn't survive serverless cold starts and isn't shared across Vercel instances. Block 6 made this fail gracefully (the UI shows an amber "Approval recorded locally" toast), but the decisions still don't persist.

### 3a. Create the project

1. Visit https://supabase.com/dashboard
2. **New project** → choose a region close to your Vercel deploy region (us-east-1 maps well to Vercel's IAD1).
3. Set a database password and save it (you won't need it for the app, but you may want it later for SQL editor access).
4. Wait ~2 minutes for provisioning.

### 3b. Run the schema

1. In the project, open **SQL Editor** → **New query**.
2. Paste the contents of `lib/db/schema.sql` (committed in this repo) and click **Run**.
3. Verify under **Table Editor** that a `sessions` table now exists with `id`, `created_at`, `input_mode`, `stage`, `error`, `raw_transcript`, `claims`, `verdicts`, `speakers` columns.

### 3c. Grab the three keys

Under **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` — the **Project URL** (top of the page).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the **anon public** key (safe to expose to the browser).
- `SUPABASE_SERVICE_ROLE_KEY` — the **service_role secret** key (server-side only; never commit).

---

## 4. Deploy to Vercel

### 4a. Push to GitHub

The branch `add-project-docs` already has the cleanup commits. Either merge it to `master` via PR, or deploy directly from that branch.

```bash
# Open the PR
gh pr create --base master --head add-project-docs --title "Cleanup pass: error isolation, eval harness, hardening"

# OR just push to master directly (only after CI in section 7 is wired up)
```

### 4b. Import the project

1. Visit https://vercel.com/new
2. Select **Import Git Repository** → pick `cheruvathoorshajd/Veritas`.
3. Vercel will auto-detect Next.js. Leave the framework preset as **Next.js** and the root directory as **/** (the GitHub repo root is already the Next.js root — no override needed).
4. **Do not deploy yet.** Click into **Environment Variables**.

### 4c. Paste env vars

Paste each variable from section 2 above into the Vercel **Environment Variables** UI. Mark them for **Production**, **Preview**, and **Development** (or scope as needed).

Critical ones for first deploy:

| Variable | Source | Required? |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | 1a | yes |
| `TAVILY_API_KEY` | 1b | yes |
| `ASSEMBLYAI_API_KEY` | 1c | yes for file upload |
| `GROQ_API_KEY` | 1d | strongly recommended |
| `NEXT_PUBLIC_SUPABASE_URL` | 3c | recommended |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3c | recommended |
| `SUPABASE_SERVICE_ROLE_KEY` | 3c | recommended |
| `LANGCHAIN_API_KEY` | 1e | optional |
| `LANGCHAIN_TRACING_V2` | `true` | optional |
| `LANGCHAIN_PROJECT` | `veritas` | optional |
| `NEXT_PUBLIC_APP_URL` | your future domain (e.g. `https://veritas.example.com`) | recommended |

### 4d. Deploy

Click **Deploy**. The first build takes ~2 minutes. Vercel will run `pnpm install && pnpm build` automatically. The `maxDuration = 60` declaration in `app/api/pipeline/route.ts` and the `vercel.json` config opt the route into the longer execution budget.

### 4e. Verify

After deploy:

1. Visit `https://YOUR-DEPLOY.vercel.app/` — the landing page should render.
2. Visit `https://YOUR-DEPLOY.vercel.app/app` and click **RUN DEMO** — should complete fully offline.
3. Try the live pipeline with a short transcript ("The US unemployment rate in March 2024 was 3.8%."). Watch the SSE stream in the Network tab; expect 1-2 verdicts within ~30 seconds.
4. Hit `https://YOUR-DEPLOY.vercel.app/api/health` — should return JSON with each provider's status. **Don't poll this** (each call hits real APIs — see the warning in the main README).

---

## 5. Set `NEXT_PUBLIC_APP_URL` to your production domain

Once Vercel gives you a URL (or you set up a custom domain — see section 11):

1. **Vercel project → Settings → Environment Variables**.
2. Edit `NEXT_PUBLIC_APP_URL` to e.g. `https://veritas.example.com` for Production, leaving it as `http://localhost:3000` for Development.
3. Trigger a redeploy (`vercel --prod`, or push an empty commit).

This matters for any code path that builds absolute URLs (export links, share URLs). Currently used sparingly, but the var is read in a few places — best to set it correctly from day one.

---

## 6. Run the evaluation harness

You committed `eval/run.ts` and `eval/claims.jsonl` but the README's "Latest run" block is still a placeholder.

### 6a. Reproduce locally

With `.env.local` containing at least `GOOGLE_GENERATIVE_AI_API_KEY` and `TAVILY_API_KEY`:

```bash
cd veritas
pnpm eval | tee eval/last-report.txt
```

Expect ~5-10 minutes for 30 claims on the Gemini free tier. The harness writes per-claim predictions to `eval/results.json` (gitignored) and prints three blocks: confusion matrix, per-label P/R/F1, aggregate stats.

### 6b. Paste numbers into the README

Open `README.md`, find the "Latest run" subsection of "Evaluation Results", and replace the three `(pending — run pnpm eval)` placeholders with the corresponding blocks from `eval/last-report.txt`. Also delete the paragraph that references `BLOCKERS.md` for context (you can delete `BLOCKERS.md` itself once the eval has run).

### 6c. Commit

```bash
git add README.md
git rm BLOCKERS.md
git commit -m "docs(readme): populate Evaluation Results with first eval run"
git push
```

---

## 7. Add a CI pipeline

Right now Vercel is the only safety net: a typecheck or lint regression only surfaces at deploy-preview time. Add a GitHub Action to gate PRs.

### 7a. Create `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push:
    branches: [master, main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsc --noEmit
      - run: pnpm lint
      - run: pnpm build
```

### 7b. Protect `master`

In **Settings → Branches → Add rule** on the GitHub repo:

- Branch name pattern: `master`
- Require status checks to pass before merging → select `check` (the job from 7a).
- Require pull request before merging.

This means future direct pushes to `master` are blocked (which is also what the local auto-mode classifier enforced when we tried earlier — now it's enforced at the platform level).

---

## 8. Add a minimal test suite

Vitest + a few well-chosen tests cover the high-leverage code paths. PROGRESS.md flagged that no tests exist; this fixes that without bloating the repo.

### 8a. Install

```bash
cd veritas
pnpm add -D vitest @vitest/coverage-v8
```

### 8b. `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
  },
})
```

### 8c. First three tests

These target the highest-risk pure functions — no API calls needed.

**`lib/utils/__tests__/json.test.ts`**

```typescript
import { describe, expect, it } from 'vitest'
import { stripFence, extractJsonArray, extractJsonObject } from '../json'

describe('stripFence', () => {
  it('strips ```json fences', () => {
    expect(stripFence('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })
  it('passes through unfenced text', () => {
    expect(stripFence('{"a":1}')).toBe('{"a":1}')
  })
})

describe('extractJsonArray', () => {
  it('parses a clean array', () => {
    expect(extractJsonArray('[1,2,3]')).toEqual([1, 2, 3])
  })
  it('recovers from prose wrapping', () => {
    expect(extractJsonArray('Here you go: [1,2,3] hope it helps')).toEqual([1, 2, 3])
  })
  it('returns null on garbage', () => {
    expect(extractJsonArray('not json at all')).toBeNull()
  })
})

describe('extractJsonObject', () => {
  it('parses a clean object', () => {
    expect(extractJsonObject('{"label":"VERIFIED"}')).toEqual({ label: 'VERIFIED' })
  })
  it('refuses arrays', () => {
    expect(extractJsonObject('[1,2,3]')).toBeNull()
  })
})
```

**`lib/agents/__tests__/verdict-heuristic.test.ts`** (test the MISLEADING confidence formula from Block 7):

```typescript
import { describe, expect, it } from 'vitest'
// You'll need to export `heuristicVerdict` from lib/agents/verdict.ts
// (it's currently file-scoped) — see step 8d below.
import { heuristicVerdict } from '../verdict'

describe('heuristicVerdict — MISLEADING confidence calibration', () => {
  it('balanced credibility sits at 55', () => {
    const v = heuristicVerdict(
      { claimText: 'x' } as any,
      [
        { source: 'a', url: '', excerpt: '', stance: 'SUPPORTS', credibilityScore: 80 },
        { source: 'b', url: '', excerpt: '', stance: 'CONTRADICTS', credibilityScore: 80 },
      ],
    )
    expect(v.label).toBe('MISLEADING')
    expect(v.confidencePct).toBe(55)
  })
  it('lopsided cases drift toward 45 within the approval band', () => {
    const v = heuristicVerdict(
      { claimText: 'x' } as any,
      [
        { source: 'a', url: '', excerpt: '', stance: 'SUPPORTS', credibilityScore: 95 },
        { source: 'b', url: '', excerpt: '', stance: 'CONTRADICTS', credibilityScore: 60 },
      ],
    )
    expect(v.label).toBe('MISLEADING')
    expect(v.confidencePct).toBeGreaterThanOrEqual(40)
    expect(v.confidencePct).toBeLessThanOrEqual(70)
  })
})
```

### 8d. Export `heuristicVerdict` so it's testable

In `lib/agents/verdict.ts`, change `function heuristicVerdict(...)` to `export function heuristicVerdict(...)`.

### 8e. Wire to package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Add `pnpm test` to the CI job in 7a before `pnpm build`.

---

## 9. Multi-instance state (rate limit + sessions)

Already documented as a production caveat in the main README; this section is about what you'd do if you wanted to actually fix it for production traffic.

### 9a. Rate limiter

The current `lib/utils/rate-limit.ts` uses an in-process `Map`. Two options if you outgrow it:

- **Upstash Redis** — Vercel's first-party Redis offering. Replace the Map with `@upstash/ratelimit`. ~30 lines of code.
- **Vercel KV** — similar story, also Redis-backed.

For a portfolio demo with single-digit users this isn't worth doing. For traffic, swap to Upstash.

### 9b. Session storage

Already handled — once Supabase env vars are set (section 3), sessions live in Postgres and approval persistence works across instances. The in-memory `Map` becomes a dev-only fallback. No code change needed.

---

## 10. Set a custom domain (cosmetic)

1. Buy/route a domain (Namecheap, Cloudflare Registrar, etc.).
2. **Vercel project → Settings → Domains → Add**.
3. Add the apex (`veritas.example.com`) and follow Vercel's instructions to set the `A` or `CNAME` record at your DNS provider.
4. Wait for SSL provisioning (~2 minutes after DNS propagates).
5. Update `NEXT_PUBLIC_APP_URL` (section 5) to match.

---

## 11. Optional: prune the repo

The outer-folder docs that got copied in earlier (`Veritas 5 Page Document.docx`, `Veritas_Comprehensive_Document.docx`, `veritas_system_architecture.svg`, `VERITAS_CLAUDE_CODE_PROMPT.md`) bloat the repo and probably don't belong in the deployment artifact.

If you want a leaner repo:

```bash
git rm "Veritas 5 Page Document.docx" \
       "Veritas_Comprehensive_Document.docx" \
       "veritas_system_architecture.svg" \
       VERITAS_CLAUDE_CODE_PROMPT.md
git commit -m "chore: move design docs out of the deploy artifact"
git push
```

Keep them somewhere else (a `docs/` GitHub repo, a Notion page, or just locally) so they're still discoverable but don't ship with every deploy.

---

## Done-when checklist

When all of the following are true, the project is genuinely production-ready:

- [ ] Live `/app` URL serves the demo without errors.
- [ ] Live pipeline produces verdicts for a 1-line transcript end-to-end.
- [ ] Approval flow persists across page refresh (verifies Supabase is wired correctly).
- [ ] `pnpm eval` produces real numbers; README "Latest run" block is populated.
- [ ] `BLOCKERS.md` is deleted.
- [ ] CI runs on every PR and blocks merge on failure.
- [ ] At least one passing test in `__tests__/`.
- [ ] Custom domain (optional but expected for portfolio).
