import { getSupabaseServer, isSupabaseConfigured, warnIfInMemoryInProduction } from './client'
import { logger } from '@/lib/utils/logger'
import type {
  InputMode,
  PipelineStage,
  Session,
  Speaker,
  TranscriptLine,
  Verdict,
  ExtractedClaim,
} from '@/lib/types'

const log = logger('db:sessions')

/**
 * Tokens for sessions whose Supabase row doesn't have an `approval_token`
 * column (the migration `db/migrations/002_approval_token.sql` hasn't been
 * applied). Process-local fallback only — works on single-instance dev;
 * on multi-instance Vercel, approval will fail across instances until the
 * migration runs.
 */
const tokenFallbackMap = new Map<string, string>()
let columnMissingWarned = false

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session ${id} not found`)
    this.name = 'SessionNotFoundError'
  }
}

export class SessionStorageError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'SessionStorageError'
  }
}

export class ApprovalTokenError extends Error {
  constructor(message = 'Invalid approval token') {
    super(message)
    this.name = 'ApprovalTokenError'
  }
}

interface SessionRow {
  id: string
  created_at: string
  input_mode: InputMode
  stage: PipelineStage
  error: string | null
  raw_transcript: TranscriptLine[] | null
  claims: ExtractedClaim[] | null
  verdicts: Verdict[] | null
  speakers: Speaker[] | null
  approval_token: string | null
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    createdAt: row.created_at,
    inputMode: row.input_mode,
    stage: row.stage,
    error: row.error,
    transcriptLines: row.raw_transcript ?? [],
    claims: row.claims ?? [],
    verdicts: row.verdicts ?? [],
    speakers: row.speakers ?? [],
    approvalToken: row.approval_token ?? undefined,
  }
}

/**
 * True when no Supabase env vars are set, so reads/writes go to the per-process
 * `memoryStore`. Callers (e.g. the approval route) use this to distinguish
 * "session genuinely missing" (real bug, return 404) from "session lives on a
 * different serverless instance" (return a no-op success so the UI keeps
 * its optimistic state).
 */
export function isMemoryMode(): boolean {
  return !isSupabaseConfigured()
}

// In-memory fallback when Supabase isn't configured (dev / demo)
const memoryStore = new Map<string, Session>()

function randomBytesHex(n: number): string {
  const bytes = new Uint8Array(n)
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function memoryId(): string {
  // RFC 4122 v4
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function newApprovalToken(): string {
  return randomBytesHex(24) // 192 bits of entropy
}

function isMissingApprovalColumn(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string }
  const msg = (e.message || '').toLowerCase()
  return (
    msg.includes('approval_token') &&
    (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column'))
  )
}

function warnColumnMissingOnce(): void {
  if (columnMissingWarned) return
  columnMissingWarned = true
  log.warn(
    "Supabase 'sessions' table is missing the 'approval_token' column. " +
      'Run db/migrations/002_approval_token.sql in your Supabase SQL editor. ' +
      'Approval tokens are being stored in process memory as a fallback — this ' +
      'only works on single-instance dev; on multi-instance Vercel, verdict ' +
      'approvals will fail across instances until the migration is applied.',
  )
}

/**
 * True when an error looks like the Supabase host isn't reachable from the
 * Node runtime — DNS lookup failure, connection refused, etc. Free-tier
 * Supabase projects pause after ~7 idle days; without this fallback the
 * whole pipeline 500s instead of degrading to in-memory storage.
 */
function isNetworkFailure(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(msg)
}

let supabaseUnreachableWarned = false
function warnSupabaseUnreachable(detail: string): void {
  if (supabaseUnreachableWarned) return
  supabaseUnreachableWarned = true
  log.warn(
    `Supabase host unreachable (${detail}). Falling back to in-memory session ` +
      'storage for this process. If this is a paused free-tier project, wake ' +
      'it at https://supabase.com/dashboard; sessions started while paused ' +
      'will not persist.',
  )
}

function memoryCreate(inputMode: InputMode, approvalToken: string): Session {
  const id = memoryId()
  const session: Session = {
    id,
    createdAt: new Date().toISOString(),
    inputMode,
    stage: 'idle',
    error: null,
    transcriptLines: [],
    claims: [],
    verdicts: [],
    speakers: [],
    approvalToken,
  }
  memoryStore.set(id, session)
  return session
}

export async function createSession(inputMode: InputMode): Promise<Session> {
  const approvalToken = newApprovalToken()
  if (!isSupabaseConfigured()) {
    warnIfInMemoryInProduction()
    return memoryCreate(inputMode, approvalToken)
  }
  const sb = getSupabaseServer()

  let data: SessionRow | null = null
  let error: { message?: string } | null = null
  try {
    const res = await sb
      .from('sessions')
      .insert({ input_mode: inputMode, stage: 'idle', approval_token: approvalToken })
      .select('*')
      .single()
    data = (res.data as SessionRow | null) ?? null
    error = res.error as { message?: string } | null
  } catch (thrown) {
    if (isNetworkFailure(thrown)) {
      warnSupabaseUnreachable((thrown as Error).message)
      return memoryCreate(inputMode, approvalToken)
    }
    throw thrown
  }

  if (error || !data) {
    if (isMissingApprovalColumn(error)) {
      warnColumnMissingOnce()
      try {
        const retry = await sb
          .from('sessions')
          .insert({ input_mode: inputMode, stage: 'idle' })
          .select('*')
          .single()
        if (retry.error || !retry.data) {
          throw new SessionStorageError(
            `Failed to create session: ${retry.error?.message ?? 'unknown error'}`,
            retry.error,
          )
        }
        const row = retry.data as SessionRow
        tokenFallbackMap.set(row.id, approvalToken)
        const session = rowToSession(row)
        session.approvalToken = approvalToken
        return session
      } catch (thrown) {
        if (isNetworkFailure(thrown)) {
          warnSupabaseUnreachable((thrown as Error).message)
          return memoryCreate(inputMode, approvalToken)
        }
        throw thrown
      }
    }
    const detail = error?.message ?? 'unknown error'
    if (/fetch failed|ENOTFOUND/i.test(detail)) {
      warnSupabaseUnreachable(detail)
      return memoryCreate(inputMode, approvalToken)
    }
    log.warn(`Supabase insert failed: ${detail}`)
    throw new SessionStorageError(`Failed to create session: ${detail}`, error)
  }
  return rowToSession(data)
}

export async function getSession(id: string): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return memoryStore.get(id) ?? null
  }
  const sb = getSupabaseServer()
  try {
    const { data, error } = await sb.from('sessions').select('*').eq('id', id).maybeSingle()
    if (error) {
      if (isNetworkFailure(error)) {
        warnSupabaseUnreachable((error as { message?: string }).message ?? 'fetch failed')
        return memoryStore.get(id) ?? null
      }
      throw new SessionStorageError('Failed to fetch session', error)
    }
    if (!data) return memoryStore.get(id) ?? null
    const session = rowToSession(data as SessionRow)
    if (!session.approvalToken && tokenFallbackMap.has(id)) {
      session.approvalToken = tokenFallbackMap.get(id)
    }
    return session
  } catch (thrown) {
    if (isNetworkFailure(thrown)) {
      warnSupabaseUnreachable((thrown as Error).message)
      return memoryStore.get(id) ?? null
    }
    throw thrown
  }
}

export async function updateSession(
  id: string,
  partial: Partial<Session>,
): Promise<Session> {
  const existing = await getSession(id)
  if (!existing) throw new SessionNotFoundError(id)
  const merged: Session = { ...existing, ...partial }

  // Memory mode (either not configured, or session lives in the fallback store)
  if (!isSupabaseConfigured() || memoryStore.has(id)) {
    memoryStore.set(id, merged)
    if (!isSupabaseConfigured()) return merged
    // Sessions in the memoryStore (because Supabase was unreachable at create
    // time) shouldn't try to round-trip to Supabase on update.
    return merged
  }

  const sb = getSupabaseServer()
  try {
    const { data, error } = await sb
      .from('sessions')
      .update({
        stage: merged.stage,
        error: merged.error,
        raw_transcript: merged.transcriptLines,
        claims: merged.claims,
        verdicts: merged.verdicts,
        speakers: merged.speakers,
      })
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) {
      if (isNetworkFailure(error)) {
        warnSupabaseUnreachable((error as { message?: string }).message ?? 'fetch failed')
        memoryStore.set(id, merged)
        return merged
      }
      throw new SessionStorageError('Failed to update session', error)
    }
    return rowToSession(data as SessionRow)
  } catch (thrown) {
    if (isNetworkFailure(thrown)) {
      warnSupabaseUnreachable((thrown as Error).message)
      memoryStore.set(id, merged)
      return merged
    }
    throw thrown
  }
}

/**
 * Constant-time-ish string comparison. Both strings are hex so we can
 * safely length-check first; otherwise fold to false bit-by-bit.
 */
function tokensEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function setVerdictApproval(
  id: string,
  verdictId: string,
  approved: boolean,
  providedToken: string,
): Promise<Verdict> {
  const existing = await getSession(id)
  if (!existing) throw new SessionNotFoundError(id)

  // Token check happens BEFORE we surface "verdict not found" so callers
  // can't distinguish "valid session, wrong verdict" from "invalid token".
  if (!tokensEqual(existing.approvalToken, providedToken)) {
    throw new ApprovalTokenError()
  }

  const idx = existing.verdicts.findIndex((v) => v.id === verdictId)
  if (idx === -1) {
    throw new SessionStorageError(`Verdict ${verdictId} not found in session ${id}`)
  }
  const updated: Verdict = { ...existing.verdicts[idx], approved }
  const nextVerdicts = [...existing.verdicts]
  nextVerdicts[idx] = updated
  await updateSession(id, { verdicts: nextVerdicts })
  return updated
}
