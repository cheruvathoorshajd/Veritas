'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptLine } from '@/lib/types'
import { startMicStream } from '@/lib/transcription/mic-stream'

type StreamState = 'idle' | 'connecting' | 'live' | 'closing'

export function MicInput({
  onLinesChanged,
  disabled,
}: {
  onLinesChanged: (lines: TranscriptLine[]) => void
  disabled?: boolean
}) {
  const [state, setState] = useState<StreamState>('idle')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [diarize, setDiarize] = useState(true)
  const linesRef = useRef<TranscriptLine[]>([])
  const activeRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const onLinesChangedRef = useRef(onLinesChanged)

  useEffect(() => {
    onLinesChangedRef.current = onLinesChanged
  }, [onLinesChanged])

  useEffect(() => {
    return () => {
      const active = activeRef.current
      activeRef.current = null
      if (active) void active.stop()
    }
  }, [])

  const start = useCallback(async () => {
    if (disabled || state !== 'idle') return
    setError(null)
    linesRef.current = []
    onLinesChangedRef.current([])
    try {
      const active = await startMicStream(
        {
          onLine: (line) => {
            linesRef.current = [...linesRef.current, line]
            onLinesChangedRef.current(linesRef.current)
          },
          onInterim: (text) => setInterim(text),
          onError: (message) => setError(message),
          onStateChange: (next) => setState(next),
        },
        { diarize },
      )
      activeRef.current = active
    } catch (err) {
      setError((err as Error).message || 'failed to start')
      setState('idle')
    }
  }, [disabled, state, diarize])

  const stop = useCallback(async () => {
    const active = activeRef.current
    activeRef.current = null
    if (active) await active.stop()
    setInterim('')
  }, [])

  const recording = state === 'live' || state === 'connecting'
  const toggle = () => (recording ? void stop() : void start())

  const label =
    state === 'connecting'
      ? 'CONNECTING'
      : state === 'live'
        ? 'RECORDING'
        : state === 'closing'
          ? 'CLOSING'
          : linesRef.current.length > 0
            ? 'SESSION ENDED'
            : 'STANDBY'

  const modeLocked = state !== 'idle'
  const hasSession = linesRef.current.length > 0
  const switchMode = (next: boolean) => {
    if (next === diarize) return
    if (hasSession) {
      const ok = window.confirm(
        'Switching mode will discard the current transcript. Continue?',
      )
      if (!ok) return
      linesRef.current = []
      onLinesChangedRef.current([])
      setInterim('')
    }
    setDiarize(next)
  }
  const modeButton = (active: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={modeLocked || disabled}
      style={{
        padding: '5px 12px',
        background: 'transparent',
        border: `1px solid ${active ? 'var(--text-muted)' : '#1A1A1A'}`,
        color: active ? 'var(--text)' : '#2E2E2E',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: 2,
        cursor: modeLocked || disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {label}
    </button>
  )

  const statusColor =
    state === 'live'
      ? 'var(--coral)'
      : state === 'connecting'
        ? 'var(--amber)'
        : state === 'closing'
          ? 'var(--text-muted)'
          : 'var(--text-muted)'

  return (
    <div className="mic-stage">
      <div className="mic-stage__mode">
        <span className="mic-stage__mode-label">MODE</span>
        {modeButton(diarize, 'MULTI-SPEAKER', () => switchMode(true))}
        {modeButton(!diarize, 'SINGLE SPEAKER', () => switchMode(false))}
      </div>

      <div className="mic-btn-slot">
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || state === 'closing'}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
          className={`mic-btn ${recording ? 'mic-btn--rec' : ''} ${state === 'connecting' ? 'mic-btn--connecting' : ''}`}
        >
          {!recording && state === 'idle' && !disabled && (
            <>
              <span className="mic-btn__wave mic-btn__wave--1" aria-hidden />
              <span className="mic-btn__wave mic-btn__wave--2" aria-hidden />
              <span className="mic-btn__wave mic-btn__wave--3" aria-hidden />
            </>
          )}
          <span className="mic-btn__icon" aria-hidden>
            {recording ? (
              <span className="mic-btn__stop" />
            ) : (
              <span className="mic-btn__dot" />
            )}
          </span>
          {recording && (
            <>
              <span className="mic-btn__halo mic-btn__halo--1" aria-hidden />
              <span className="mic-btn__halo mic-btn__halo--2" aria-hidden />
            </>
          )}
          {state === 'connecting' && <span className="mic-btn__spinner" aria-hidden />}
        </button>
      </div>

      <div className="mic-stage__status" style={{ color: statusColor }}>
        {label}
      </div>

      <div className="mic-stage__bars" aria-hidden>
        {Array.from({ length: 32 }, (_, i) => {
          const h = 4 + ((i * 7) % 18)
          return (
            <span
              key={i}
              style={{
                width: 2,
                background: recording ? 'var(--coral)' : 'var(--border-bright)',
                borderRadius: 2,
                height: recording ? undefined : 2,
                ['--h' as string]: `${h}px`,
                animation: recording
                  ? `wave-bar ${0.7 + (i % 5) * 0.12}s ease ${i * 0.04}s infinite`
                  : 'none',
              } as React.CSSProperties}
            />
          )
        })}
      </div>

      <div className="mic-stage__interim">{interim || ' '}</div>

      {error && <div className="mic-stage__error">{error}</div>}
    </div>
  )
}
