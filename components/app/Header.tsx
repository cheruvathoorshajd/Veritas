'use client'

import type { InputMode, PipelineStage } from '@/lib/types'

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

const MODE_LABEL: Record<InputMode, { num: string; label: string }> = {
  mic: { num: '01', label: 'MIC LIVE' },
  file: { num: '02', label: 'DOCUMENT' },
  text: { num: '03', label: 'TEXT PASTE' },
}

export function Header({
  stage,
  sessionId,
  running,
  inputMode,
  onRunDemo,
  onReset,
  onStop,
  onBack,
  onHome,
}: {
  stage: PipelineStage
  sessionId?: string
  running: boolean
  inputMode?: InputMode
  onRunDemo: () => void
  onReset: () => void
  onStop: () => void
  onBack?: () => void
  onHome?: () => void
}) {
  const status = STATUS[stage]
  const hasSession = Boolean(sessionId)
  const mode = inputMode ? MODE_LABEL[inputMode] : null

  return (
    <header
      style={{
        padding: '22px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)',
        gap: 24,
      }}
    >
      {/* Left cluster: back + wordmark + mode label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to deck"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-muted)',
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: 2,
              cursor: 'pointer',
              transition: 'border-color 200ms ease, color 200ms ease',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--coral)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--coral)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            }}
          >
            ← BACK
          </button>
        )}

        <button
          type="button"
          onClick={onHome}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            padding: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            letterSpacing: 4,
            cursor: onHome ? 'pointer' : 'default',
          }}
        >
          VERITAS
        </button>

        {mode && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 8,
              paddingLeft: 14,
              borderLeft: '1px solid var(--border-bright)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              letterSpacing: 2.5,
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ color: 'var(--coral)' }}>{mode.num}</span>
            <span>{mode.label}</span>
          </span>
        )}

        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: 2,
            color: status.color,
          }}
        >
          ({status.label})
        </span>
      </div>

      {/* Right cluster: session id + actions + home */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
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
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--coral)',
              color: 'var(--coral)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            STOP
          </button>
        )}
        <span className="tooltip-wrap">
          <button
            type="button"
            onClick={hasSession ? onReset : onRunDemo}
            disabled={running}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              color: running ? 'var(--text-muted)' : 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: 2,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? 'RUNNING…' : hasSession ? 'RUN AGAIN' : 'RUN DEMO'}
          </button>
          {!running && !hasSession && (
            <span className="tooltip" role="tooltip">
              <span className="tooltip__label">DEMO ONLY</span>
              Plays back canned text-paste data so you can see the pipeline end-to-end.
              It does not use your mic or uploaded document — switch back to the deck to verify
              your own input.
            </span>
          )}
        </span>
        {onHome && (
          <button
            type="button"
            onClick={onHome}
            aria-label="Home"
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: 2,
              cursor: 'pointer',
              transition: 'border-color 200ms ease, color 200ms ease',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--coral)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--coral)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
            }}
          >
            ⌂ HOME
          </button>
        )}
      </div>
    </header>
  )
}
