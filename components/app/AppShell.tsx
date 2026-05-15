'use client'

import { useCallback, useRef, useState } from 'react'
import type {
  ExtractedClaim,
  InputMode,
  PipelineStage,
  Speaker,
  StreamEvent,
  TranscriptLine,
  Verdict,
} from '@/lib/types'
import { Header } from './Header'
import { InputSection } from './InputSection'
import { PipelineBar } from './PipelineBar'
import { TranscriptFeed } from './TranscriptFeed'
import { VerdictFeed } from './VerdictFeed'
import { SpeakerScores } from './SpeakerScores'
import { ExportButton } from './ExportButton'
import { SectionLabel } from './SectionLabel'
import { DEMO_CLAIMS, DEMO_TRANSCRIPT, DEMO_VERDICTS } from './demoData'
import { generateReportClient } from './reportClient'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function AppShell() {
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [claims, setClaims] = useState<ExtractedClaim[]>([])
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const demoAbortRef = useRef<{ aborted: boolean } | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (demoAbortRef.current) demoAbortRef.current.aborted = true
    demoAbortRef.current = null
    setStage('idle')
    setSessionId(undefined)
    setTranscriptLines([])
    setClaims([])
    setVerdicts([])
    setSpeakers([])
    setErrorMsg(null)
    setRunning(false)
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (demoAbortRef.current) demoAbortRef.current.aborted = true
    demoAbortRef.current = null
    setRunning(false)
    setStage((s) => (s === 'complete' || s === 'error' ? s : 'idle'))
  }, [])

  const handleApprove = useCallback(
    (verdictId: string, approved: boolean) => {
      // Optimistic update
      setVerdicts((prev) =>
        prev.map((v) => (v.id === verdictId ? { ...v, approved } : v)),
      )
      if (!sessionId || sessionId.startsWith('demo-')) return
      void (async () => {
        try {
          const res = await fetch(`/api/session/${sessionId}/approval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ verdictId, approved }),
          })
          if (!res.ok) throw new Error(`approval failed: ${res.status}`)
        } catch (err) {
          // Roll back optimistic update on failure
          setVerdicts((prev) =>
            prev.map((v) => (v.id === verdictId ? { ...v, approved: null } : v)),
          )
          setErrorMsg(`Could not save approval: ${(err as Error).message}`)
        }
      })()
    },
    [sessionId],
  )

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'stage':
        setStage(event.stage)
        break
      case 'transcript_line':
        setTranscriptLines((prev) =>
          prev.some((l) => l.id === event.line.id) ? prev : [...prev, event.line],
        )
        break
      case 'claim_detected':
        setClaims((prev) =>
          prev.some((c) => c.id === event.claim.id) ? prev : [...prev, event.claim],
        )
        break
      case 'verdict':
        setVerdicts((prev) =>
          prev.some((v) => v.id === event.verdict.id) ? prev : [...prev, event.verdict],
        )
        break
      case 'speaker_update':
        setSpeakers((prev) => {
          const idx = prev.findIndex((s) => s.id === event.speaker.id)
          if (idx === -1) return [...prev, event.speaker]
          const next = [...prev]
          next[idx] = event.speaker
          return next
        })
        break
      case 'complete':
        setSessionId(event.sessionId)
        setStage('complete')
        setRunning(false)
        break
      case 'error':
        setErrorMsg(event.message)
        setStage('error')
        setRunning(false)
        break
      default:
        break
    }
  }, [])

  const runDemo = useCallback(async () => {
    reset()
    setRunning(true)
    const token = { aborted: false }
    demoAbortRef.current = token
    const id = `demo-${Math.random().toString(36).slice(2, 10)}`
    setSessionId(id)
    setInputMode('text')

    await delay(600)
    if (token.aborted) return
    setStage('input')
    await delay(800)
    if (token.aborted) return
    setStage('transcribe')

    const claimBySpeakerTime = new Map<string, ExtractedClaim>()
    for (const c of DEMO_CLAIMS) claimBySpeakerTime.set(`${c.speaker}:${c.timestamp}`, c)

    for (let i = 0; i < DEMO_TRANSCRIPT.length; i++) {
      const line = DEMO_TRANSCRIPT[i]
      await delay(1200)
      if (token.aborted) return
      setTranscriptLines((prev) => [...prev, line])
      const matched = claimBySpeakerTime.get(`${line.speaker}:${line.timestamp}`)
      if (matched) {
        await delay(500)
        if (token.aborted) return
        setStage('extract')
        setClaims((prev) => [...prev, matched])
      }
    }

    for (let i = 0; i < DEMO_VERDICTS.length; i++) {
      await delay(600)
      if (token.aborted) return
      setStage('verify')
      await delay(1700)
      if (token.aborted) return
      setStage('verdict')
      setVerdicts((prev) => [...prev, DEMO_VERDICTS[i]])
      if (i < DEMO_VERDICTS.length - 1) {
        await delay(300)
        if (token.aborted) return
        setStage('transcribe')
      }
    }

    await delay(600)
    if (token.aborted) return
    const computedSpeakers = generateReportClient(DEMO_VERDICTS, DEMO_TRANSCRIPT)
    setSpeakers(computedSpeakers)
    setStage('complete')
    setRunning(false)
    demoAbortRef.current = null
  }, [reset])

  const runPipeline = useCallback(
    async (lines: TranscriptLine[]) => {
      if (!lines.length) return
      reset()
      setRunning(true)
      setTranscriptLines(lines)
      setStage('input')

      let currentSessionId: string | undefined
      try {
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputMode }),
        })
        if (res.ok) {
          const body = (await res.json()) as { sessionId?: string }
          currentSessionId = body.sessionId
          if (currentSessionId) setSessionId(currentSessionId)
        }
      } catch {
        // continue without session; pipeline will make its own
      }

      const controller = new AbortController()
      abortRef.current = controller

      let response: Response
      try {
        response = await fetch('/api/pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: currentSessionId,
            transcriptLines: lines,
            inputMode,
          }),
          signal: controller.signal,
        })
      } catch (err) {
        setErrorMsg((err as Error).message)
        setStage('error')
        setRunning(false)
        return
      }

      if (!response.ok || !response.body) {
        const txt = await response.text().catch(() => '')
        setErrorMsg(txt || `Pipeline error ${response.status}`)
        setStage('error')
        setRunning(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split('\n\n')
          buffer = chunks.pop() ?? ''
          for (const chunk of chunks) {
            const lineText = chunk
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trim())
              .join('')
            if (!lineText) continue
            try {
              const parsed = JSON.parse(lineText) as StreamEvent
              handleStreamEvent(parsed)
            } catch {
              // ignore bad frame
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setErrorMsg((err as Error).message)
          setStage('error')
        }
      } finally {
        setRunning(false)
      }
    },
    [handleStreamEvent, inputMode, reset],
  )

  const onTranscript = useCallback(
    (lines: TranscriptLine[]) => {
      if (inputMode === 'mic') {
        // Mic streams lines as they come in; store but don't auto-run.
        setTranscriptLines(lines)
      } else {
        // File / text: when a complete transcript arrives, run the pipeline.
        if (lines.length > 0) void runPipeline(lines)
      }
    },
    [inputMode, runPipeline],
  )

  return (
    <div
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
        minHeight: '100vh',
        fontFamily: 'var(--font-body)',
      }}
    >
      <Header
        stage={stage}
        sessionId={sessionId}
        running={running}
        onRunDemo={runDemo}
        onReset={reset}
        onStop={handleStop}
      />

      <div style={{ padding: '28px 48px 80px', maxWidth: 1200, margin: '0 auto' }}>
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              border: '1px solid var(--coral)',
              background: 'var(--coral-dim)',
              color: 'var(--coral)',
              fontSize: 15,
              marginBottom: 24,
            }}
          >
            {errorMsg}
          </div>
        )}

        <section id="input">
          <SectionLabel num="01" text="Input" />
          <InputSection
            inputMode={inputMode}
            onModeChange={(m) => setInputMode(m)}
            onTranscript={onTranscript}
            stage={stage}
          />
          {inputMode === 'mic' && transcriptLines.length > 0 && (
            <button
              type="button"
              onClick={() => void runPipeline(transcriptLines)}
              disabled={running}
              style={{
                padding: '12px 22px',
                background: running ? 'var(--border)' : 'var(--coral)',
                color: running ? 'var(--text-muted)' : '#fff',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: 14,
                letterSpacing: 2,
                cursor: running ? 'not-allowed' : 'pointer',
                marginTop: 12,
              }}
            >
              RUN PIPELINE ON {transcriptLines.length} LINE{transcriptLines.length === 1 ? '' : 'S'} →
            </button>
          )}
          <PipelineBar stage={stage} />
        </section>

        <section id="transcript">
          <SectionLabel num="02" text="Transcript" />
          <TranscriptFeed lines={transcriptLines} claims={claims} />
        </section>

        <section id="verdicts">
          <SectionLabel num="03" text={`Verdicts — ${verdicts.length} claim${verdicts.length === 1 ? '' : 's'} checked`} />
          <VerdictFeed verdicts={verdicts} onApprove={handleApprove} />
        </section>

        {speakers.length > 0 && (
          <section id="speakers">
            <SectionLabel num="04" text="Speaker accuracy" />
            <SpeakerScores speakers={speakers} />
            <ExportButton sessionId={sessionId} />
          </section>
        )}
      </div>
    </div>
  )
}
