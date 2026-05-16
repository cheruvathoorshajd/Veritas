import { getSupabaseServer, isSupabaseConfigured } from './client'
import type {
  InputMode,
  PipelineStage,
  Session,
  Speaker,
  TranscriptLine,
  Verdict,
  ExtractedClaim,
} from '@/lib/types'

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

export async function createSession(inputMode: InputMode): Promise<Session> {
  if (!isSupabaseConfigured()) {
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
    }
    memoryStore.set(id, session)
    return session
  }
  const sb = getSupabaseServer()
  const { data, error } = await sb
    .from('sessions')
    .insert({ input_mode: inputMode, stage: 'idle' })
    .select('*')
    .single()
  if (error || !data) {
    throw new SessionStorageError('Failed to create session', error)
  }
  return rowToSession(data as SessionRow)
}

export async function getSession(id: string): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return memoryStore.get(id) ?? null
  }
  const sb = getSupabaseServer()
  const { data, error } = await sb.from('sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw new SessionStorageError('Failed to fetch session', error)
  if (!data) return null
  return rowToSession(data as SessionRow)
}

export async function updateSession(
  id: string,
  partial: Partial<Session>,
): Promise<Session> {
  const existing = await getSession(id)
  if (!existing) throw new SessionNotFoundError(id)
  const merged: Session = { ...existing, ...partial }

  if (!isSupabaseConfigured()) {
    memoryStore.set(id, merged)
    return merged
  }
  const sb = getSupabaseServer()
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
  if (error || !data) throw new SessionStorageError('Failed to update session', error)
  return rowToSession(data as SessionRow)
}

export async function setVerdictApproval(
  id: string,
  verdictId: string,
  approved: boolean,
): Promise<Verdict> {
  const existing = await getSession(id)
  if (!existing) throw new SessionNotFoundError(id)
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
