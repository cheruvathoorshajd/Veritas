-- ---------------------------------------------------------------------------
-- 002 · Per-session approval token
-- ---------------------------------------------------------------------------
-- Adds an `approval_token` column to `sessions` so the /api/session/[id]/
-- approval endpoint can require a bearer token issued at session creation.
-- The token is generated server-side (24 hex bytes ≈ 192 bits of entropy)
-- and returned to the client exactly once in the POST /api/session response.
--
-- Run this in the Supabase SQL editor (or via `supabase db push`) BEFORE
-- deploying the matching application code. If you skip the migration, the
-- application will error on session insert with `column "approval_token"
-- of relation "sessions" does not exist`.
--
-- Safe to re-run: uses IF NOT EXISTS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS approval_token TEXT;

-- Optional but recommended: don't let stale rows accept any token.
-- Existing rows from before this migration will have NULL approval_token,
-- which the constant-time comparison treats as "no valid token possible."
COMMENT ON COLUMN public.sessions.approval_token IS
  'Bearer token issued at session create. Required on POST /api/session/[id]/approval.';
