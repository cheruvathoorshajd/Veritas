'use client'

import { useCallback } from 'react'
import type { Verdict } from '@/lib/types'

interface UseApprovalArgs {
  sessionId: string | undefined
  approvalToken: string | undefined
  setVerdicts: React.Dispatch<React.SetStateAction<Verdict[]>>
  setErrorMsg: (msg: string | null) => void
  setAdvisoryMsg: (msg: string | null) => void
}

/**
 * Owns the approval flow: optimistic local update → POST to Supabase
 * approval endpoint → handle persistence-mode advisory or rollback. The
 * hook returns a single stable callback you can hand to VerdictFeed.
 *
 * Lives here (not in AppShell) so AppShell can stay focused on state and
 * SSE plumbing — IO + advisory + rollback are a self-contained concern.
 */
export function useApproval({
  sessionId,
  approvalToken,
  setVerdicts,
  setErrorMsg,
  setAdvisoryMsg,
}: UseApprovalArgs) {
  return useCallback(
    (verdictId: string, approved: boolean) => {
      // Optimistic update — the UI reflects the new state immediately.
      setVerdicts((prev) =>
        prev.map((v) => (v.id === verdictId ? { ...v, approved } : v)),
      )
      if (!sessionId || sessionId.startsWith('demo-')) return

      if (!approvalToken) {
        // Token was lost (session created before this client load, or the
        // server didn't return one). Roll back the optimistic state and
        // tell the user how to recover.
        setVerdicts((prev) =>
          prev.map((v) => (v.id === verdictId ? { ...v, approved: null } : v)),
        )
        setErrorMsg(
          'Cannot save approval — no approval token for this session. Start a new session and try again.',
        )
        return
      }

      void (async () => {
        try {
          const res = await fetch(`/api/session/${sessionId}/approval`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${approvalToken}`,
            },
            body: JSON.stringify({ verdictId, approved }),
          })

          const payload = (await res.json().catch(() => null)) as
            | { ok?: boolean; persisted?: boolean; error?: string; code?: string; retryAfterSeconds?: number }
            | null

          if (!res.ok) {
            // Roll back optimistic state and surface a typed message.
            setVerdicts((prev) =>
              prev.map((v) => (v.id === verdictId ? { ...v, approved: null } : v)),
            )
            if (res.status === 429) {
              const retry = payload?.retryAfterSeconds ?? 60
              setErrorMsg(
                `Approval rate-limited. Try again in ${retry}s.`,
              )
              return
            }
            if (res.status === 401) {
              setErrorMsg(
                payload?.code === 'missing_token'
                  ? 'Approval token missing. Reload the page to issue a fresh session.'
                  : 'Approval token rejected. Start a new session to record approvals.',
              )
              return
            }
            setErrorMsg(payload?.error || `Approval failed (HTTP ${res.status}).`)
            return
          }

          // When Supabase isn't configured the route returns 200 with
          // persisted: false (session lives in a per-instance Map). Keep
          // the optimistic state and surface a short advisory so the user
          // knows it won't survive.
          if (payload && payload.persisted === false) {
            setAdvisoryMsg('Approval recorded locally — not persisted (Supabase not configured).')
          }
        } catch (err) {
          setVerdicts((prev) =>
            prev.map((v) => (v.id === verdictId ? { ...v, approved: null } : v)),
          )
          setErrorMsg(`Could not save approval: ${(err as Error).message}`)
        }
      })()
    },
    [sessionId, approvalToken, setVerdicts, setErrorMsg, setAdvisoryMsg],
  )
}
