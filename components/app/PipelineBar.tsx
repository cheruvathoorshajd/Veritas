'use client'

import type { PipelineStage } from '@/lib/types'

const STAGES: { id: string; label: string; match: PipelineStage[] }[] = [
  { id: 'input', label: 'INPUT', match: ['input'] },
  { id: 'asr', label: 'ASR', match: ['transcribe'] },
  { id: 'diarize', label: 'DIARIZE', match: ['diarize'] },
  { id: 'extract', label: 'EXTRACT', match: ['extract'] },
  { id: 'verify', label: 'VERIFY', match: ['verify'] },
  { id: 'verdict', label: 'VERDICT', match: ['verdict'] },
]

const ORDER: PipelineStage[] = [
  'idle',
  'input',
  'transcribe',
  'diarize',
  'extract',
  'verify',
  'verdict',
  'complete',
]

function stageIndex(s: PipelineStage): number {
  const i = ORDER.indexOf(s)
  return i < 0 ? 0 : i
}

export function PipelineBar({ stage }: { stage: PipelineStage }) {
  const current = stageIndex(stage)
  const isError = stage === 'error'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 10,
      }}
    >
      {STAGES.map((s, i) => {
        const stageOrderIdx = i + 1
        const done = current > stageOrderIdx && !isError
        const active = s.match.includes(stage) && !isError
        const dotColor = isError
          ? 'var(--coral)'
          : active
            ? 'var(--coral)'
            : done
              ? 'var(--teal)'
              : 'var(--border)'
        const labelColor = isError
          ? 'var(--coral)'
          : active
            ? 'var(--amber)'
            : done
              ? 'var(--teal)'
              : 'var(--text-dim)'
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i === STAGES.length - 1 ? 0 : 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  position: 'relative',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dotColor,
                  border: active || done ? 'none' : '1px solid var(--text-dim)',
                }}
              >
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: -5,
                      borderRadius: '50%',
                      border: '1px solid var(--coral)',
                      animation: 'pulse-ring 1.4s ease infinite',
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: labelColor,
                }}
              >
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 1,
                  margin: '0 8px',
                  background: done ? 'var(--teal)' : 'var(--border)',
                  transform: done ? 'scaleX(1)' : 'scaleX(0.4)',
                  transformOrigin: 'left',
                  transition: 'transform 0.4s ease, background 0.4s ease',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
