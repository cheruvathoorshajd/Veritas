'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { InputDeck } from './InputDeck'
import { PipelineBar } from './PipelineBar'
import { TranscriptFeed } from './TranscriptFeed'
import { VerdictFeed } from './VerdictFeed'
import { SpeakerScores } from './SpeakerScores'
import { Genealogy } from './Genealogy'
import { ExportButton } from './ExportButton'
import { SectionLabel } from './SectionLabel'
import { DEMO_CLAIMS, DEMO_TRANSCRIPT, DEMO_VERDICTS } from './demoData'
import { generateReportClient } from './reportClient'
import { useApproval } from './useApproval'
import { useRunCurtain, useTransitionNavigate } from '@/components/PageTransition'

type View = 'deck' | 'feature'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function AppShell() {
  const [view, setView] = useState<View>('deck')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [stage, setStage] = useState<PipelineStage>('idle')
  const runCurtain = useRunCurtain()
  const transitionNavigate = useTransitionNavigate()
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [approvalToken, setApprovalToken] = useState<string | undefined>(undefined)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [claims, setClaims] = useState<ExtractedClaim[]>([])
  const [verdicts, setVerdicts] = useState<Verdict[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [advisoryMsg, setAdvisoryMsg] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!advisoryMsg) return
    const t = setTimeout(() => setAdvisoryMsg(null), 4000)
    return () => clearTimeout(t)
  }, [advisoryMsg])
  const abortRef = useRef<AbortController | null>(null)
  const demoAbortRef = useRef<{ aborted: boolean } | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (demoAbortRef.current) demoAbortRef.current.aborted = true
    demoAbortRef.current = null
    setStage('idle')
    setSessionId(undefined)
    setApprovalToken(undefined)
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

  const handleApprove = useApproval({
    sessionId,
    approvalToken,
    setVerdicts,
    setErrorMsg,
    setAdvisoryMsg,
  })

  const hasSession =
    stage !== 'idle' || transcriptLines.length > 0 || verdicts.length > 0
  const resumeMode = hasSession ? inputMode : null

  const handleCardPick = useCallback(
    (mode: InputMode) => {
      const needsReset = mode !== inputMode
      runCurtain(() => {
        if (needsReset) reset()
        setInputMode(mode)
        setView('feature')
        if (typeof window !== 'undefined') window.scrollTo(0, 0)
      })
    },
    [inputMode, reset, runCurtain],
  )

  const handleBack = useCallback(() => {
    // stop any in-flight work, but keep all data so the user can resume
    abortRef.current?.abort()
    abortRef.current = null
    if (demoAbortRef.current) demoAbortRef.current.aborted = true
    demoAbortRef.current = null
    if (running) setRunning(false)
    runCurtain(() => {
      setView('deck')
      if (typeof window !== 'undefined') window.scrollTo(0, 0)
    })
  }, [running, runCurtain])

  const handleHome = useCallback(() => {
    transitionNavigate('/')
  }, [transitionNavigate])

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
          const body = (await res.json()) as {
            sessionId?: string
            approvalToken?: string
          }
          currentSessionId = body.sessionId
          if (currentSessionId) setSessionId(currentSessionId)
          if (body.approvalToken) setApprovalToken(body.approvalToken)
        } else if (res.status === 429) {
          const payload = (await res.json().catch(() => null)) as
            | { retryAfterSeconds?: number; error?: string }
            | null
          setErrorMsg(
            payload?.error ||
              `Session creation rate-limited. Try again in ${payload?.retryAfterSeconds ?? 60}s.`,
          )
          setStage('error')
          setRunning(false)
          return
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
        // Attempt to parse a structured error body; fall back to text.
        type ApiError = {
          error?: string
          code?: string
          retryAfterSeconds?: number
          hitWindow?: string
        }
        let parsed: ApiError | null = null
        let raw = ''
        try {
          raw = await response.text()
          parsed = raw ? (JSON.parse(raw) as ApiError) : null
        } catch {
          parsed = null
        }
        let message: string
        if (response.status === 429) {
          const retry = parsed?.retryAfterSeconds ?? 60
          const win = parsed?.hitWindow ? ` (${parsed.hitWindow})` : ''
          message = `Pipeline rate-limited${win}. Try again in ${retry}s.`
        } else if (response.status === 400 && parsed?.error) {
          message = `Bad input: ${parsed.error}`
        } else if (parsed?.error) {
          message = parsed.error
        } else {
          message = raw || `Pipeline error ${response.status}`
        }
        setErrorMsg(message)
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

  if (view === 'deck') {
    return (
      <div className="page-enter">
        <InputDeck onPick={handleCardPick} onHome={handleHome} resumeMode={resumeMode} />
      </div>
    )
  }

  return (
    <div
      className="page-enter"
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
        inputMode={inputMode}
        onRunDemo={runDemo}
        onReset={reset}
        onStop={handleStop}
        onBack={handleBack}
        onHome={handleHome}
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

        {advisoryMsg && (
          <div
            style={{
              padding: '10px 14px',
              border: '1px solid var(--amber)',
              background: 'var(--amber-dim)',
              color: 'var(--amber)',
              fontSize: 15,
              marginBottom: 24,
            }}
          >
            {advisoryMsg}
          </div>
        )}

        <section id="input">
          <SectionLabel num="01" text="Input" />
          <InputSection
            inputMode={inputMode}
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
            <SpeakerScores speakers={speakers} verdicts={verdicts} />
            {claims.length > 1 && (
              <>
                <SectionLabel num="05" text="Claim genealogy" />
                <Genealogy claims={claims} verdicts={verdicts} />
              </>
            )}
            <ExportButton
              sessionId={sessionId}
              transcriptLines={transcriptLines}
              claims={claims}
              verdicts={verdicts}
              speakers={speakers}
              inputMode={inputMode}
            />
          </section>
        )}
      </div>
    </div>
  )
}
