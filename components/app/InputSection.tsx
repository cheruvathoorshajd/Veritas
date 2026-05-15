'use client'

import type { InputMode, PipelineStage, TranscriptLine } from '@/lib/types'
import { MicInput } from './MicInput'
import { FileInput } from './FileInput'
import { TextInput } from './TextInput'

const TABS: Array<{ id: InputMode; label: string }> = [
  { id: 'mic', label: 'Mic live' },
  { id: 'file', label: 'File upload' },
  { id: 'text', label: 'Text paste' },
]

export function InputSection({
  inputMode,
  onModeChange,
  onTranscript,
  stage,
}: {
  inputMode: InputMode
  onModeChange: (m: InputMode) => void
  onTranscript: (lines: TranscriptLine[]) => void
  stage: PipelineStage
}) {
  const running = stage !== 'idle' && stage !== 'complete' && stage !== 'error'
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map((t) => {
          const active = t.id === inputMode
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onModeChange(t.id)}
              disabled={running}
              style={{
                padding: '9px 18px',
                background: 'transparent',
                border: `1px solid ${active ? 'var(--text-muted)' : '#1A1A1A'}`,
                color: active ? 'var(--text)' : '#2E2E2E',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: 2,
                cursor: running ? 'not-allowed' : 'pointer',
              }}
            >
              {t.label.toUpperCase()}
            </button>
          )
        })}
      </div>
      <div>
        {inputMode === 'mic' && (
          <MicInput onLinesChanged={onTranscript} disabled={running} />
        )}
        {inputMode === 'file' && <FileInput onTranscript={onTranscript} disabled={running} />}
        {inputMode === 'text' && <TextInput onSubmit={onTranscript} disabled={running} />}
      </div>
    </div>
  )
}
