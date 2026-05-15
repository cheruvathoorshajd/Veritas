'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptLine } from '@/lib/types'
import { chunkToTranscriptLine } from '@/lib/transcription/web-speech'

// Web Speech API types (not in stock DOM lib)
interface SRAlternative {
  transcript: string
  confidence: number
}
interface SRResult {
  0: SRAlternative
  isFinal: boolean
  length: number
}
interface SREvent extends Event {
  resultIndex: number
  results: { length: number; [i: number]: SRResult }
}
interface SRErrorEvent extends Event {
  error: string
  message?: string
}
interface SRInstance {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  stop(): void
}
type SRCtor = new () => SRInstance

function getSpeechRecognition(): SRCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SRCtor
    webkitSpeechRecognition?: SRCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function MicInput({
  onLinesChanged,
  disabled,
}: {
  onLinesChanged: (lines: TranscriptLine[]) => void
  disabled?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SRInstance | null>(null)
  const linesRef = useRef<TranscriptLine[]>([])
  const startAtRef = useRef<number>(0)

  useEffect(() => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setSupported(false)
      return
    }
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.onresult = (e: SREvent) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        const text = res[0]?.transcript ?? ''
        if (res.isFinal) {
          const nowMs = Date.now() - startAtRef.current
          const line = chunkToTranscriptLine(text.trim(), 'A', Math.max(0, nowMs - 2000))
          if (line.text) {
            linesRef.current = [...linesRef.current, line]
            onLinesChanged(linesRef.current)
          }
        } else {
          interimText += text
        }
      }
      setInterim(interimText)
    }
    rec.onerror = (e) => {
      setError(e.error || 'microphone error')
    }
    rec.onend = () => {
      setRecording(false)
      setInterim('')
    }
    recognitionRef.current = rec
    return () => {
      try {
        rec.onresult = null
        rec.onerror = null
        rec.onend = null
        rec.stop()
      } catch {
        // ignore
      }
    }
  }, [onLinesChanged])

  const toggle = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || disabled) return
    if (recording) {
      try {
        rec.stop()
      } catch {
        // ignore
      }
      setRecording(false)
    } else {
      setError(null)
      linesRef.current = []
      onLinesChanged([])
      startAtRef.current = Date.now()
      try {
        rec.start()
        setRecording(true)
      } catch (err) {
        setError((err as Error).message || 'failed to start')
      }
    }
  }, [recording, disabled, onLinesChanged])

  const label = !supported
    ? 'UNSUPPORTED'
    : recording
      ? 'RECORDING'
      : linesRef.current.length > 0
        ? 'SESSION ENDED'
        : 'STANDBY'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '30px 0' }}>
      <button
        type="button"
        onClick={toggle}
        disabled={!supported || disabled}
        aria-label={recording ? 'Stop recording' : 'Start recording'}
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: 'transparent',
          border: `1px solid ${recording ? 'var(--coral)' : 'var(--border-bright)'}`,
          cursor: !supported || disabled ? 'not-allowed' : 'pointer',
          color: recording ? 'var(--coral)' : 'var(--text)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
      >
        ●
        {recording && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: -2,
              borderRadius: '50%',
              border: '1px solid var(--coral)',
              animation: 'pulse-ring 1.6s ease infinite',
            }}
          />
        )}
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
        {Array.from({ length: 15 }, (_, i) => {
          const h = 4 + ((i * 7) % 14)
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

      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: 2,
          color: recording ? 'var(--coral)' : 'var(--text-muted)',
          minWidth: 120,
        }}
      >
        {label}
      </div>

      {interim && (
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-muted)',
            opacity: 0.65,
            fontStyle: 'italic',
            maxWidth: 400,
          }}
        >
          {interim}
        </div>
      )}
      {error && (
        <div style={{ color: 'var(--coral)', fontSize: 14 }}>{error}</div>
      )}
      {!supported && (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Web Speech API unsupported in this browser.
        </div>
      )}
    </div>
  )
}
