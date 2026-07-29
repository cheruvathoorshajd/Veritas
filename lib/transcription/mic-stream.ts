import { normaliseSpeaker } from './speaker-map'
import { chunkToTranscriptLine } from './web-speech'
import type { TranscriptLine } from '@/lib/types'

// Inlined from `assemblyai` so this module never references the SDK at compile
// time — keeps webpack's SSR module graph clean, and the SDK is only fetched
// from the browser via the dynamic import inside startMicStream.
interface MinimalTurnEvent {
  transcript?: string
  end_of_turn?: boolean
  speaker_label?: string
}

const TARGET_SAMPLE_RATE = 16_000

export interface MicStreamCallbacks {
  onLine: (line: TranscriptLine) => void
  onInterim: (text: string) => void
  onError: (message: string) => void
  onStateChange: (state: 'idle' | 'connecting' | 'live' | 'closing') => void
}

export interface MicStreamOptions {
  diarize?: boolean
}

interface ActiveStream {
  stop: () => Promise<void>
}

export async function startMicStream(
  cb: MicStreamCallbacks,
  opts: MicStreamOptions = {},
): Promise<ActiveStream> {
  const diarize = opts.diarize ?? true
  cb.onStateChange('connecting')

  const tokenRes = await fetch('/api/transcribe/realtime-token', { method: 'POST' })
  if (!tokenRes.ok) {
    const body = (await tokenRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `token fetch failed (${tokenRes.status})`)
  }
  const { token } = (await tokenRes.json()) as { token: string }

  // Dynamic import so the AssemblyAI SDK is only loaded in the browser at
  // click time — keeps it out of the SSR module graph.
  const { StreamingTranscriber } = await import('assemblyai')

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  })

  const audioCtx = new AudioContext()
  await audioCtx.audioWorklet.addModule('/mic-pcm-worklet.js')
  const source = audioCtx.createMediaStreamSource(mediaStream)
  const worklet = new AudioWorkletNode(audioCtx, 'mic-pcm-processor')

  const transcriber = new StreamingTranscriber({
    token,
    sampleRate: TARGET_SAMPLE_RATE,
    encoding: 'pcm_s16le',
    speechModel: 'universal-streaming-english',
    speakerLabels: diarize,
    formatTurns: true,
    minTurnSilence: 1500,
  })

  const speakerMap = new Map<string, string>()
  const startWallMs = Date.now()
  let closed = false
  let socketOpen = false
  let lastErrorMessage: string | null = null

  const reportError = (message: string) => {
    if (message === lastErrorMessage) return
    lastErrorMessage = message
    cb.onError(message)
  }

  transcriber.on('open', () => {
    socketOpen = true
    cb.onStateChange('live')
  })
  transcriber.on('error', (err: Error) => {
    socketOpen = false
    reportError(err.message || 'streaming error')
  })
  transcriber.on('close', (_code: number, reason: string) => {
    socketOpen = false
    if (!closed && reason) reportError(reason)
    closed = true
    cb.onStateChange('idle')
  })
  transcriber.on('turn', (event: MinimalTurnEvent) => {
    const text = (event.transcript ?? '').trim()
    if (!text) return
    if (!event.end_of_turn) {
      cb.onInterim(text)
      return
    }
    cb.onInterim('')
    const speaker = diarize
      ? normaliseSpeaker(event.speaker_label ?? 'A', speakerMap)
      : 'A'
    const nowMs = Math.max(0, Date.now() - startWallMs - 1000)
    const line = chunkToTranscriptLine(text, speaker, nowMs)
    cb.onLine(line)
  })

  await transcriber.connect()

  // Resample Float32 frames from audioCtx.sampleRate to TARGET_SAMPLE_RATE
  // via linear interpolation, encode little-endian PCM16, and batch into ~100 ms
  // windows. AssemblyAI rejects sendAudio chunks shorter than 50 ms or longer
  // than 1000 ms; AudioWorklet emits ~2.67 ms per render quantum, so we have
  // to buffer ~38 worklet frames before each send.
  const inputRate = audioCtx.sampleRate
  const FRAME_MS = 100
  const SAMPLES_PER_FRAME = (TARGET_SAMPLE_RATE * FRAME_MS) / 1000
  let leftover: Float32Array | null = null
  let pendingPcm = new Int16Array(0)

  const flush = () => {
    while (pendingPcm.length >= SAMPLES_PER_FRAME) {
      const chunk = pendingPcm.slice(0, SAMPLES_PER_FRAME)
      pendingPcm = pendingPcm.slice(SAMPLES_PER_FRAME)
      if (!socketOpen || closed) return
      try {
        transcriber.sendAudio(chunk.buffer)
      } catch (err) {
        socketOpen = false
        reportError((err as Error).message || 'send failed')
        return
      }
    }
  }

  worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
    if (closed) return
    let frame = e.data
    if (leftover && leftover.length > 0) {
      const merged = new Float32Array(leftover.length + frame.length)
      merged.set(leftover, 0)
      merged.set(frame, leftover.length)
      frame = merged
      leftover = null
    }

    const ratio = inputRate / TARGET_SAMPLE_RATE
    const outLen = Math.floor(frame.length / ratio)
    if (outLen <= 0) {
      leftover = frame
      return
    }

    const pcm = new Int16Array(outLen)
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * ratio
      const idx0 = Math.floor(srcIdx)
      const idx1 = Math.min(idx0 + 1, frame.length - 1)
      const t = srcIdx - idx0
      const sample = frame[idx0] * (1 - t) + frame[idx1] * t
      const clamped = Math.max(-1, Math.min(1, sample))
      pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    }

    const consumed = Math.ceil(outLen * ratio)
    if (consumed < frame.length) {
      leftover = frame.slice(consumed)
    }

    const next = new Int16Array(pendingPcm.length + pcm.length)
    next.set(pendingPcm, 0)
    next.set(pcm, pendingPcm.length)
    pendingPcm = next

    flush()
  }

  source.connect(worklet)

  return {
    stop: async () => {
      closed = true
      cb.onStateChange('closing')
      try {
        worklet.port.onmessage = null
        worklet.disconnect()
        source.disconnect()
      } catch {
        // ignore
      }
      try {
        mediaStream.getTracks().forEach((t) => t.stop())
      } catch {
        // ignore
      }
      try {
        await audioCtx.close()
      } catch {
        // ignore
      }
      try {
        await transcriber.close(false)
      } catch {
        // ignore
      }
      cb.onStateChange('idle')
    },
  }
}
