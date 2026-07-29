'use client'

import { useCallback, useRef, useState } from 'react'
import type { TranscriptLine } from '@/lib/types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileInput({
  onTranscript,
  disabled,
}: {
  onTranscript: (lines: TranscriptLine[]) => void
  disabled?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (f: File) => {
      setFile(f)
      setStatus('uploading')
      setError(null)
      setProgress(10)
      try {
        const form = new FormData()
        form.append('file', f)
        const timer = setInterval(() => {
          setProgress((p) => (p < 85 ? p + 5 : p))
        }, 500)
        const res = await fetch('/api/transcribe', { method: 'POST', body: form })
        clearInterval(timer)
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string; code?: string; retryAfterSeconds?: number; hitWindow?: string }
            | null
          if (res.status === 429) {
            const retry = body?.retryAfterSeconds ?? 60
            const win = body?.hitWindow ? ` (${body.hitWindow})` : ''
            throw new Error(`Upload rate-limited${win}. Try again in ${retry}s.`)
          }
          if (res.status === 413) {
            throw new Error(body?.error || 'File too large — 25 MB max.')
          }
          if (res.status === 415 || res.status === 422) {
            throw new Error(body?.error || `Upload rejected (HTTP ${res.status})`)
          }
          throw new Error(body?.error || `Upload failed (${res.status})`)
        }
        const data = (await res.json()) as { lines: TranscriptLine[] }
        setProgress(100)
        setStatus('done')
        onTranscript(data.lines ?? [])
      } catch (err) {
        setStatus('error')
        setError((err as Error).message)
      }
    },
    [onTranscript],
  )

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (disabled) return
      const f = e.dataTransfer.files?.[0]
      if (f) void handleFile(f)
    },
    [disabled, handleFile],
  )

  return (
    <div style={{ padding: '30px 0' }}>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: '1px dashed var(--text-dim)',
          padding: '48px 32px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: 'var(--text-muted)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 15,
          letterSpacing: 1.5,
        }}
      >
        {file ? (
          <div>
            <div style={{ color: 'var(--text)', marginBottom: 8 }}>
              {file.name} · {formatSize(file.size)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              CLICK OR DROP TO REPLACE
            </div>
          </div>
        ) : (
          <div>
            <div style={{ color: 'var(--text)', marginBottom: 8 }}>DROP DOCUMENT HERE</div>
            <div style={{ fontSize: 13 }}>.DOCX · .PDF · MAX 25MB</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
          }}
        />
      </div>

      {status === 'uploading' && (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              height: 1,
              background: 'var(--border-bright)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--coral)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--text-muted)',
              letterSpacing: 1.5,
            }}
          >
            EXTRACTING · {progress}%
          </div>
        </div>
      )}
      {status === 'done' && (
        <div style={{ marginTop: 14, color: 'var(--teal)', fontSize: 14 }}>
          Document parsed — running pipeline.
        </div>
      )}
      {error && (
        <div style={{ marginTop: 14, color: 'var(--coral)', fontSize: 15 }}>{error}</div>
      )}
    </div>
  )
}
