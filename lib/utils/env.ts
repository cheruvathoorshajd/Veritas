/**
 * Phase 2D — Environment variable validation.
 *
 * Single source of truth for which env vars are required. The validator
 * is called from the pipeline route and the eval harness — anything that
 * actually needs the keys will fail loudly and consistently rather than
 * surfacing a 500 from a deep retrieval call.
 *
 * Never include a value in any error message — the names are sufficient
 * for the operator and the values are secrets.
 */

import { logger } from './logger'

const log = logger('env')

export interface RequiredEnvCheck {
  ok: boolean
  missing: string[]
}

const PIPELINE_REQUIRED = ['GOOGLE_GENERATIVE_AI_API_KEY', 'TAVILY_API_KEY'] as const
const FILE_UPLOAD_REQUIRED: string[] = [] // mammoth / pdf-parse have no key
const MIC_REQUIRED = ['ASSEMBLYAI_API_KEY'] as const

export function checkPipelineEnv(): RequiredEnvCheck {
  const missing = PIPELINE_REQUIRED.filter((k) => !process.env[k])
  return { ok: missing.length === 0, missing }
}

export function checkMicEnv(): RequiredEnvCheck {
  const missing = MIC_REQUIRED.filter((k) => !process.env[k])
  return { ok: missing.length === 0, missing }
}

export function checkFileUploadEnv(): RequiredEnvCheck {
  return { ok: true, missing: FILE_UPLOAD_REQUIRED }
}

/**
 * Aggregate check used by the health endpoint and (optionally) at module
 * import time. Logs missing keys by NAME only — never logs values.
 */
export function assertPipelineEnvOrLog(): RequiredEnvCheck {
  const result = checkPipelineEnv()
  if (!result.ok) {
    log.error('Pipeline env vars missing — live pipeline will fail', {
      missing: result.missing,
    })
  }
  return result
}

/** Validates that no API key shape leaks into a string (logging guard). */
export function looksLikeSecret(value: string): boolean {
  if (!value) return false
  return (
    /AIza[0-9A-Za-z_-]{30,}/.test(value) ||
    /gsk_[0-9A-Za-z]{40,}/.test(value) ||
    /tvly-[0-9A-Za-z-]{10,}/.test(value) ||
    /lsv2_pt_[0-9A-Za-z]{20,}/.test(value) ||
    /sk-[0-9A-Za-z]{20,}/.test(value)
  )
}
