# Veritas — Go-Live Handoff (Phases 2–4)

Phases 0, 1, and 6 are done: the build passes, the deployable code is on the
GitHub branch **`production`**, and CI runs on every push/PR. This doc covers the
three steps that require a browser login (Supabase + Vercel) — I can't
authenticate as you, so run these yourself. Follow top to bottom.

> Env-var values live in your local `.env.local`. Copy them from there — this
> doc never prints secret values.

---

## Phase 2 — Supabase (persistence)

Without this, sessions and approval decisions live in an in-process `Map` that
does not survive serverless cold starts. Your keys are already set locally; the
cloud schema just needs to be applied.

1. Go to https://supabase.com/dashboard and open the project that matches the
   `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local`.
   - If that project no longer exists, create a new one (region close to your
     Vercel region — `us-east-1` pairs well with Vercel `iad1`), then update the
     three `SUPABASE*` values in `.env.local` **and** in Vercel (Phase 3).
2. **SQL Editor → New query** → paste the full contents of **`lib/db/schema.sql`**
   → **Run**.
3. **SQL Editor → New query** → paste **`db/migrations/002_approval_token.sql`**
   → **Run**.
4. **Table Editor** → confirm a **`sessions`** table exists with columns:
   `id, created_at, input_mode, stage, error, raw_transcript, claims, verdicts,
   speakers` (plus the approval-token column from the migration).

✅ **Exit criteria:** `sessions` table present with the migration applied.

---

## Phase 3 — Deploy to Vercel

The repo is already Vercel-ready: `vercel.json` sets `maxDuration` for the
pipeline/transcribe routes, and `next.config.mjs` sets security headers + CSP.

### 3a. Import the repo

1. https://vercel.com/new → **Import** `cheruvathoorshajd/Veritas`.
2. Framework preset: **Next.js** (auto-detected). Root directory: **`/`**.
3. **Production Branch:** set to **`production`** (Project → Settings → Git, or
   during import). This is the branch pushed in Phase 1 — *not* `main`.
4. **Do not deploy yet** — open **Environment Variables** first.

### 3b. Environment variables

Paste each of these from your `.env.local`. Scope to **Production** (and Preview
if you want preview deploys to work). `NEXT_PUBLIC_*` are exposed to the browser
by design; the rest are server-only — never expose them.

| Variable | Required? | Notes |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | **yes** | Primary LLM (Gemini) |
| `TAVILY_API_KEY` | **yes** | Search / retrieval |
| `ASSEMBLYAI_API_KEY` | yes for audio | Mic + file transcription |
| `GROQ_API_KEY` | recommended | Auto-fallback when Gemini hits quota |
| `NEXT_PUBLIC_SUPABASE_URL` | recommended | client-visible |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | recommended | client-visible |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended | **server-only secret** |
| `LANGCHAIN_API_KEY` | optional | observability |
| `LANGCHAIN_TRACING_V2` | optional | set to `true` to enable tracing |
| `LANGCHAIN_PROJECT` | optional | e.g. `veritas` |
| `NEXT_PUBLIC_APP_URL` | recommended | set to the Vercel URL after first deploy (Phase 4) |

> `LANGCHAIN_TRACING_V2` is in `.env.example` but not currently in `.env.local`
> — add it (`true`) if you want LangSmith traces.

### 3c. Deploy

Click **Deploy**. First build ~2 min (`pnpm install && pnpm build`).

✅ **Exit criteria:** a live `https://<project>.vercel.app` URL.

---

## Phase 4 — Set the production URL

1. Vercel → **Settings → Environment Variables** → set `NEXT_PUBLIC_APP_URL` to
   the real deploy URL (e.g. `https://veritas-xxxx.vercel.app`) for Production.
2. **Redeploy** so the new value is baked in (Deployments → ⋯ → Redeploy, or push
   any commit to `production`).

---

## Phase 5 — Verify live

Run this checklist against the deployed URL:

- [ ] `/` — landing page renders.
- [ ] `/app` → **RUN DEMO** completes end-to-end (works fully offline).
- [ ] Live pipeline: paste *"The US unemployment rate in March 2024 was 3.8%."*
      → expect 1–2 verdicts within ~30s (watch the SSE stream in the Network tab).
- [ ] `/api/health` → returns JSON with each provider's status.
      **One-shot only — do not poll it** (each call hits real, paid APIs).
- [ ] Approve a verdict, then refresh the page → the approval persists
      (confirms Supabase is wired correctly).

When all five pass, **Veritas is live.** ✅

---

## Notes / follow-ups

- **Deploy branch is `production`, not `main`.** `origin/main` currently holds an
  older, unrelated snapshot (from the outer `D:\Veritas` repo). If you later want
  `main` to be canonical, reconcile the two histories deliberately — don't
  fast-forward, they share no common ancestor.
- **Custom domain (optional):** Vercel → Settings → Domains → Add, then update
  `NEXT_PUBLIC_APP_URL` to match.
- **Branch protection (optional):** GitHub → Settings → Branches → require the
  `check` CI job before merging into `production`.
