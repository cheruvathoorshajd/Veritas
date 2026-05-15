'use client'

import type { PipelineStage } from '@/lib/types'

const STATUS: Record<PipelineStage, { label: string; color: string }> = {
  idle: { label: 'READY', color: 'var(--text-muted)' },
  input: { label: 'LIVE', color: 'var(--teal)' },
  transcribe: { label: 'LIVE', color: 'var(--teal)' },
  diarize: { label: 'LIVE', color: 'var(--teal)' },
  extract: { label: 'VERIFYING', color: 'var(--amber)' },
  verify: { label: 'VERIFYING', color: 'var(--amber)' },
  verdict: { label: 'VERIFYING', color: 'var(--amber)' },
  complete: { label: 'COMPLETE', color: 'var(--teal)' },
  error: { label: 'ERROR', color: 'var(--coral)' },
}

export function Header({
  stage,
  sessionId,
  running,
  onRunDemo,
  onReset,
  onStop,
}: {
  stage: PipelineStage
  sessionId?: string
  running: boolean
  onRunDemo: () => void
  onReset: () => void
  onStop: () => void
}) {
  const status = STATUS[stage]
  const hasSession = Boolean(sessionId)
  return (
    <header
      style={{
        padding: '26px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <a
          href="/"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            letterSpacing: '4px',
            color: 'var(--text)',
            textDecoration: 'none',
          }}
        >
          VERITAS
        </a>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            letterSpacing: 2,
            color: status.color,
          }}
        >
          ({status.label})
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: 1.5,
          color: 'var(--text-muted)',
        }}
      >
        {hasSession && <span>SESSION · {sessionId?.slice(0, 8).toUpperCase()}</span>}
        {running && (
          <button
            type="button"
            onClick={onStop}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: '1px solid var(--coral)',
              color: 'var(--coral)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            STOP
          </button>
        )}
        <button
          type="button"
          onClick={hasSession ? onReset : onRunDemo}
          disabled={running}
          style={{
            padding: '10px 18px',
            background: 'transparent',
            border: '1px solid var(--border-bright)',
            color: running ? 'var(--text-muted)' : 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: 2,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? 'RUNNING…' : hasSession ? 'RUN AGAIN' : 'RUN DEMO'}
        </button>
      </div>
    </header>
  )
}
