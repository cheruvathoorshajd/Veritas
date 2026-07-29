# 🚀 Deploying Veritas — Complete Go-Live Guide

A step-by-step guide to taking Veritas from source code to a live, public URL.
Follow it top to bottom; each phase unblocks the next. Total hands-on time is
about **15–20 minutes**, most of it clicking through the Supabase and Vercel
dashboards.

> **Deploy from the `main` branch.** `main` holds the canonical, build-passing
> project. Don't deploy from any other branch.

---

## Table of contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Prerequisites](#2-prerequisites)
3. [Get your API keys](#3-get-your-api-keys)
4. [Phase A — Local sanity check](#4-phase-a--local-sanity-check)
5. [Phase B — Supabase (persistence)](#5-phase-b--supabase-persistence)
6. [Phase C — Deploy to Vercel](#6-phase-c--deploy-to-vercel)
7. [Phase D — Set the production URL](#7-phase-d--set-the-production-url)
8. [Phase E — Verify it's live](#8-phase-e--verify-its-live)
9. [Environment variable reference](#9-environment-variable-reference)
10. [Continuous deployment](#10-continuous-deployment)
11. [Custom domain (optional)](#11-custom-domain-optional)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture at a glance

Veritas is a **Next.js 14 (App Router)** application deployed as **Vercel
serverless functions**. It has no separate backend — the API routes under
`app/api/*` run on-demand.

| Component | Role | Hosting |
|---|---|---|
| Next.js app (`/`, `/app`) | Landing page + the fact-check product UI | Vercel (static + serverless) |
| `app/api/pipeline` | SSE streaming fact-check pipeline (LangGraph state machine) | Vercel function, `maxDuration = 60` |
| `app/api/transcribe` | `.docx` / `.pdf` upload + AssemblyAI audio | Vercel function, `maxDuration = 30` |
| Gemini / Groq | LLM (Groq is the automatic fallback on quota) | External API |
| Tavily | Web search / evidence retrieval | External API |
| AssemblyAI | Transcription + diarization | External API |
| Supabase (Postgres) | Session + approval persistence across instances | Supabase cloud |

**Why Supabase matters:** without it, sessions and verdict approvals live in a
per-instance in-memory `Map` that does not survive serverless cold starts and is
not shared across regions. The app degrades gracefully without it, but approvals
won't persist. Set it up for a real deploy.

---

## 2. Prerequisites

- A [GitHub](https://github.com) account with access to
  `cheruvathoorshajd/Veritas` (already pushed — deploy from `main`).
- A [Vercel](https://vercel.com) account (free Hobby tier is fine).
- A [Supabase](https://supabase.com) account (free tier is fine).
- Locally: **Node 20+** and **pnpm 10+** (`npm i -g pnpm`) if you want to run the
  sanity check in Phase A.

---

## 3. Get your API keys

Three keys are required; two more are strongly recommended. Free tiers are
sufficient for a demo.

| Service | Where | Free tier | Required? |
|---|---|---|---|
| **Google Gemini** | https://aistudio.google.com/app/apikey | 1M tokens/day, 15 rpm | **Yes** (primary LLM) |
| **Tavily** | https://app.tavily.com/home | 1,000 searches/month | **Yes** (retrieval) |
| **AssemblyAI** | https://www.assemblyai.com/app/account | 100 hours | Yes for audio/file upload |
| **Groq** | https://console.groq.com/keys | Generous, fast | Recommended (LLM fallback) |
| **LangSmith** | https://smith.langchain.com/settings | Free | Optional (tracing) |

Keep these somewhere safe — you'll paste them into `.env.local` (Phase A) and
Vercel (Phase C).

---

## 4. Phase A — Local sanity check

*(Optional but recommended — catches problems before they hit Vercel.)*

```bash
cd veritas
cp .env.example .env.local     # then paste your real keys into .env.local
pnpm install
pnpm typecheck                 # tsc --noEmit
pnpm lint
pnpm test                      # 120 unit tests
pnpm build                     # must succeed
pnpm dev                       # http://localhost:3000
```

Visit `http://localhost:3000/app` and click **RUN DEMO** — it completes fully
offline. If `pnpm build` passes, Vercel will build too.

✅ **Exit criteria:** `pnpm build` exits 0.

---

## 5. Phase B — Supabase (persistence)

1. Open the [Supabase dashboard](https://supabase.com/dashboard).
2. **New project** → pick a region close to your Vercel region (`us-east-1`
   pairs well with Vercel's `iad1`). Set a DB password, wait ~2 min.
3. **SQL Editor → New query** → paste the full contents of **`lib/db/schema.sql`**
   → **Run**.
4. **New query** → paste **`db/migrations/002_approval_token.sql`** → **Run**.
5. **Table Editor** → confirm a **`sessions`** table exists with columns
   `id, created_at, input_mode, stage, error, raw_transcript, claims, verdicts,
   speakers` plus the approval-token column.
6. **Project Settings → API** → copy the three values you'll need in Phase C:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role secret** key → `SUPABASE_SERVICE_ROLE_KEY` *(server-only —
     never expose)*

✅ **Exit criteria:** `sessions` table present, three keys copied.

---

## 6. Phase C — Deploy to Vercel

The repo is already Vercel-ready: `vercel.json` sets the function duration
budgets and `next.config.mjs` sets security headers + CSP.

### 6a. Import

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import Git Repository** → select `cheruvathoorshajd/Veritas`.
3. Framework preset: **Next.js** (auto-detected). Root directory: **`/`**.
4. **Settings → Git → Production Branch → `main`.** ⚠️ This is the most common
   mistake — make sure it's `main`, not `master` or anything else.
5. **Do not click Deploy yet** — expand **Environment Variables** first.

### 6b. Environment variables

Add each variable from the [reference table](#9-environment-variable-reference)
below. Scope them to **Production** (and **Preview** if you want preview
deployments to work). `NEXT_PUBLIC_*` vars are exposed to the browser by design;
all others are server-only.

### 6c. Deploy

Click **Deploy**. The first build runs `pnpm install && pnpm build` (~2 min).

✅ **Exit criteria:** a live `https://<project>.vercel.app` URL.

---

## 7. Phase D — Set the production URL

1. Vercel → **Settings → Environment Variables** → set `NEXT_PUBLIC_APP_URL` to
   your live URL (e.g. `https://veritas-xxxx.vercel.app`) for **Production**.
2. **Redeploy** so the value is baked in (Deployments → ⋯ → **Redeploy**, or push
   any commit to `main`).

---

## 8. Phase E — Verify it's live

Run this checklist against the deployed URL:

- [ ] `/` — the landing page renders.
- [ ] `/app` → **RUN DEMO** completes end-to-end (works fully offline).
- [ ] **Live pipeline:** paste *"The US unemployment rate in March 2024 was
      3.8%."* → expect 1–2 verdicts within ~30s (watch the SSE stream in the
      Network tab).
- [ ] `/api/health` → returns JSON with each provider's status.
      **One-shot only — do not poll** (every call hits real, paid APIs).
- [ ] Approve a verdict, then **refresh** → the approval persists (confirms
      Supabase is wired correctly).

When all five pass, **Veritas is live.** 🎉

---

## 9. Environment variable reference

| Variable | Required? | Exposed to browser? | Source |
|---|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | **Yes** | No | Gemini (§3) |
| `TAVILY_API_KEY` | **Yes** | No | Tavily (§3) |
| `ASSEMBLYAI_API_KEY` | Yes for audio | No | AssemblyAI (§3) |
| `GROQ_API_KEY` | Recommended | No | Groq (§3) — LLM fallback |
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | **Yes** | Supabase (§5) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | **Yes** | Supabase (§5) |
| `SUPABASE_SERVICE_ROLE_KEY` | Recommended | No — **secret** | Supabase (§5) |
| `LANGCHAIN_API_KEY` | Optional | No | LangSmith (§3) |
| `LANGCHAIN_TRACING_V2` | Optional | No | set to `true` to enable tracing |
| `LANGCHAIN_PROJECT` | Optional | No | e.g. `veritas` |
| `NEXT_PUBLIC_APP_URL` | Recommended | **Yes** | your live URL (Phase D) |

> **Never commit real keys.** `.env` and `.env.local` are gitignored. Only
> `.env.example` (placeholders) is tracked.

---

## 10. Continuous deployment

Once imported, Vercel auto-deploys on every push to **`main`**. Pull requests
get preview deployments automatically.

A GitHub Actions workflow (`.github/workflows/ci.yml`) also runs on every push
and PR: **install → typecheck → lint → test (120 tests) → build**. To require it
before merging: GitHub → **Settings → Branches → Add rule** → pattern `main` →
require the `check` status check + require a PR before merging.

---

## 11. Custom domain (optional)

1. Buy/route a domain (Namecheap, Cloudflare Registrar, etc.).
2. Vercel → **Settings → Domains → Add** → follow the `A`/`CNAME` instructions.
3. Wait for SSL (~2 min after DNS propagates).
4. Update `NEXT_PUBLIC_APP_URL` (Phase D) to match, then redeploy.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Vercel build fails on lint/type errors | A regression got in | Run `pnpm build` locally (Phase A) to reproduce and fix before pushing |
| Pipeline returns 500 immediately | Missing `GOOGLE_GENERATIVE_AI_API_KEY` or `TAVILY_API_KEY` | Add them in Vercel env vars, redeploy. Check `/api/health` once |
| Approvals don't persist after refresh | Supabase not wired | Re-check the three `SUPABASE*` vars and that the schema ran (Phase B) |
| Pipeline times out on long transcripts | Function duration | Already set to 60s via `vercel.json`; keep transcripts short for the demo |
| Gemini quota errors | Free-tier rate limit | Set `GROQ_API_KEY` — the `ResilientLLM` wrapper falls back automatically |
| Audio upload fails | Missing `ASSEMBLYAI_API_KEY` | Add it, or use the text/demo paths which don't need it |
| Wrong branch deployed | Production Branch not `main` | Vercel → Settings → Git → set Production Branch to `main` |

---

### Related docs
- `docs/GO-LIVE.md` — condensed handoff version of this guide.
- `docs/DEPLOYMENT.md` — original 11-section hardening walkthrough.
- `README.md` — project overview and architecture.
