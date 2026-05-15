'use client'

import { useState } from 'react'
import type { TranscriptLine } from '@/lib/types'
import { parseTranscriptFromText } from '@/lib/transcription/web-speech'

export function TextInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (lines: TranscriptLine[]) => void
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const canSubmit = !disabled && trimmed.length > 0

  return (
    <div style={{ padding: '30px 0' }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={'Paste a conversation or transcript here...\n\nSpeaker A: The unemployment rate is 2.1 percent.\nSpeaker B: Inflation dropped to under one percent this year.'}
        disabled={disabled}
        rows={10}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--border-bright)',
          color: 'var(--text)',
          padding: 16,
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          const lines = parseTranscriptFromText(trimmed)
          if (lines.length) onSubmit(lines)
        }}
        style={{
          marginTop: 14,
          width: '100%',
          padding: '14px 20px',
          background: canSubmit ? 'var(--coral)' : 'var(--border)',
          color: canSubmit ? '#fff' : 'var(--text-muted)',
          border: 'none',
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          letterSpacing: 2,
          cursor: canSubmit ? 'pointer' : 'not-allowed',
        }}
      >
        RUN PIPELINE →
      </button>
    </div>
  )
}
