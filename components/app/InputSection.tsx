'use client'

import type { InputMode, PipelineStage, TranscriptLine } from '@/lib/types'
import { MicInput } from './MicInput'
import { FileInput } from './FileInput'
import { TextInput } from './TextInput'

const LABELS: Record<InputMode, { num: string; label: string; desc: string }> = {
  mic: {
    num: '01',
    label: 'Mic live',
    desc: 'Stream audio in real time, diarized as it comes in.',
  },
  file: {
    num: '02',
    label: 'Document',
    desc: 'Drop a Word .docx or PDF; text is extracted on the server.',
  },
  text: {
    num: '03',
    label: 'Text paste',
    desc: 'Paste a transcript or conversation. Speaker A: / B: prefixes are honoured.',
  },
}

export function InputSection({
  inputMode,
  onTranscript,
  stage,
}: {
  inputMode: InputMode
  onTranscript: (lines: TranscriptLine[]) => void
  stage: PipelineStage
}) {
  const running = stage !== 'idle' && stage !== 'complete' && stage !== 'error'
  const meta = LABELS[inputMode]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          padding: '18px 0 22px',
          borderBottom: '1px solid var(--border-bright)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: 2,
            color: 'var(--coral)',
          }}
        >
          {meta.num}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            letterSpacing: 2.5,
            color: 'var(--text)',
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{meta.desc}</span>
      </div>

      <div key={inputMode} className="panel-enter">
        {inputMode === 'mic' && (
          <MicInput onLinesChanged={onTranscript} disabled={running} />
        )}
        {inputMode === 'file' && <FileInput onTranscript={onTranscript} disabled={running} />}
        {inputMode === 'text' && <TextInput onSubmit={onTranscript} disabled={running} />}
      </div>
    </div>
  )
}
