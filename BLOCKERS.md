# Blockers

## 2026-05-15 — Block 8 (eval harness): cannot execute against real APIs

**Block:** 8 — Evaluation harness.
**Blocker:** `pnpm eval` requires `GOOGLE_GENERATIVE_AI_API_KEY` and `TAVILY_API_KEY` (the harness intentionally hits the real upstream APIs — there is no mock path, since the whole point is to measure end-to-end performance). Neither key was available in the environment where this cleanup pass was performed; `.env.local` is absent and `.env.example` ships empty.

**What is committed:**
- `eval/claims.jsonl` — 30 hand-labelled claims (VERIFIED 8, FALSE 8, MISLEADING 7, UNVERIFIED 7; the UNVERIFIED slice includes 5 deliberately fabricated claims for which retrieval should return nothing).
- `eval/run.ts` — Node script that calls `runVeritasPipeline` directly, writes `eval/results.json`, and prints the confusion matrix, per-label P/R/F1 (macro + weighted), mean iterations/evidence/latency, and approval-required count.
- `pnpm eval` script.
- `eval/results.json` added to `.gitignore` (regenerated each run).
- README "Evaluation Results" section with the harness contract, reproduction command, and qualitative expectations — confusion-matrix and F1 blocks marked `(pending — run \`pnpm eval\`)`.

**Confirmed working:**
- `pnpm tsc --noEmit`, `pnpm lint`, `pnpm build` all clean with the harness compiled in.
- `pnpm eval` with no env vars exits 1 with the clear-error message the spec required.

**To unblock:** supply `GOOGLE_GENERATIVE_AI_API_KEY` and `TAVILY_API_KEY` (and optionally `GROQ_API_KEY` for quota fallback) in `.env.local`, then run `pnpm eval | tee eval/last-report.txt` and paste the three blocks into the README under "Latest run".
