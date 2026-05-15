'use client'

import { useReveal } from './useReveal'

const STAGES = [
  { num: '01', title: 'Input', desc: 'Mic · file · paste' },
  { num: '02', title: 'Transcribe', desc: 'AssemblyAI + Web Speech' },
  { num: '03', title: 'Diarize', desc: 'AssemblyAI diarization' },
  { num: '04', title: 'Extract', desc: 'NER + claim detector' },
  { num: '05', title: 'Verify', desc: 'ReAct web RAG loop' },
  { num: '06', title: 'Verdict', desc: 'Label + confidence' },
]

export function Pipeline() {
  const ref = useReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id="pipeline"
      style={{ padding: '120px 48px', borderBottom: '1px solid var(--border)' }}
    >
      <div className="section-label reveal">
        <span className="num">(02)</span>
        <span>HOW IT WORKS</span>
      </div>

      <p
        className="reveal delay-1"
        style={{
          fontSize: 30,
          lineHeight: 1.4,
          maxWidth: 760,
          margin: '0 0 80px',
          color: 'var(--text)',
        }}
      >
        Six layers. Eight to fifteen seconds. Speech to verdict.
      </p>

      <div
        className="reveal delay-2"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1000,
          marginBottom: 40,
        }}
      >
        {STAGES.map((s, i) => (
          <div
            key={s.num}
            style={{ display: 'flex', alignItems: 'center', flex: i === STAGES.length - 1 ? 0 : 1 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  i === 0 ? 'var(--coral)' : i === STAGES.length - 1 ? 'var(--teal)' : 'var(--text-muted)',
                flexShrink: 0,
              }}
            />
            {i < STAGES.length - 1 && (
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background: 'var(--border-bright)',
                  margin: '0 12px',
                  transformOrigin: 'left',
                  animation: `line-grow 0.8s ease ${0.2 + i * 0.2}s both`,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 24,
          maxWidth: 1000,
        }}
      >
        {STAGES.map((s, i) => (
          <div key={s.num} className={`reveal delay-${(i % 6) + 1}`}>
            <div
              style={{
                color: 'var(--coral)',
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                letterSpacing: 1.5,
                marginBottom: 8,
              }}
            >
              {s.num}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{s.title}</div>
            <div style={{ fontSize: 14, color: '#555' }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
