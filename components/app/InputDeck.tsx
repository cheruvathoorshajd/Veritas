'use client'

import { useState } from 'react'
import type { InputMode } from '@/lib/types'

interface CardSpec {
  id: InputMode
  num: string
  title: string
  tagline: string
}

const CARDS: CardSpec[] = [
  { id: 'mic', num: '01', title: 'MIC LIVE', tagline: 'Stream a conversation. Diarized as it lands.' },
  { id: 'file', num: '02', title: 'DOCUMENT', tagline: 'Word or PDF. We pull the text on the server.' },
  { id: 'text', num: '03', title: 'TEXT PASTE', tagline: 'Speaker A: / B: prefixes are honoured.' },
]

export function InputDeck({
  onPick,
  onHome,
  resumeMode,
}: {
  onPick: (mode: InputMode) => void
  onHome: () => void
  resumeMode?: InputMode | null
}) {
  const [hovered, setHovered] = useState<InputMode | null>(null)

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 48px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            letterSpacing: 4,
            color: 'var(--text)',
          }}
        >
          VERITAS
        </span>
        <button
          type="button"
          onClick={onHome}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-bright)',
            color: 'var(--text-muted)',
            padding: '10px 18px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            letterSpacing: 2,
            cursor: 'pointer',
            transition: 'border-color 200ms ease, color 200ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--coral)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--coral)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-bright)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
          }}
        >
          ⌂ HOME
        </button>
      </header>

      {/* Deck */}
      <section
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          perspective: 1400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 32px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 1200,
            height: '100%',
            transformStyle: 'preserve-3d',
          }}
        >
          {CARDS.map((c, i) => {
            const idxFromCenter = i - 1
            const baseRotate = idxFromCenter * 8
            const baseX = idxFromCenter * 260
            const baseY = idxFromCenter === 0 ? 0 : Math.abs(idxFromCenter) * 8
            const lifted = hovered === c.id ? -22 : 0
            const tilt = hovered === c.id ? baseRotate * 0.4 : baseRotate
            const isResume = resumeMode === c.id

            return (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onPick(c.id)}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 'min(320px, 26vw)',
                  height: 'min(440px, 62vh)',
                  padding: 0,
                  background: cardBg(c.id),
                  border: `1px solid ${hovered === c.id ? 'var(--coral)' : 'var(--border-bright)'}`,
                  cursor: 'pointer',
                  transform: `translate(-50%, -50%) translateX(${baseX}px) translateY(${baseY + lifted}px) rotate(${tilt}deg)`,
                  transition:
                    'transform 540ms cubic-bezier(0.16, 1, 0.3, 1), border-color 260ms ease, box-shadow 360ms ease',
                  transformStyle: 'preserve-3d',
                  boxShadow:
                    hovered === c.id
                      ? '0 30px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,61,46,0.22)'
                      : '0 14px 30px rgba(0,0,0,0.4)',
                  textAlign: 'left',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-body)',
                  overflow: 'hidden',
                  zIndex: hovered === c.id ? 20 : 10 - Math.abs(idxFromCenter),
                }}
              >
                <CardFace cardId={c.id} num={c.num} title={c.title} tagline={c.tagline} resume={isResume} />
              </button>
            )
          })}
        </div>
      </section>

      <footer
        style={{
          flexShrink: 0,
          padding: '14px 48px 16px',
          borderTop: '1px solid var(--border)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: 2,
          color: 'var(--text-dim)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>VERITAS · THE TRUTH MACHINE</span>
        <span>{resumeMode ? `RESUME AVAILABLE · ${labelFor(resumeMode)}` : 'PICK A CARD TO BEGIN'}</span>
      </footer>
    </div>
  )
}

function labelFor(m: InputMode): string {
  return m === 'mic' ? 'MIC LIVE' : m === 'file' ? 'DOCUMENT' : 'TEXT PASTE'
}

function CardFace({
  cardId,
  num,
  title,
  tagline,
  resume,
}: {
  cardId: InputMode
  num: string
  title: string
  tagline: string
  resume: boolean
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', padding: 28, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 3, color: 'var(--text-muted)' }}>
          {num}
        </span>
        {resume ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: 2,
              color: 'var(--teal)',
              border: '1px solid rgba(0,217,139,0.4)',
              padding: '3px 8px',
            }}
          >
            ● RESUME
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 3, color: 'var(--text-muted)' }}>
            VERITAS
          </span>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CardGlyph cardId={cardId} />
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, letterSpacing: 3, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{tagline}</div>
      </div>
    </div>
  )
}

function CardGlyph({ cardId }: { cardId: InputMode }) {
  if (cardId === 'mic') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--coral)',
            boxShadow: '0 0 0 8px rgba(255,61,46,0.10), 0 0 40px rgba(255,61,46,0.32)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
        </div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
          {Array.from({ length: 22 }, (_, i) => (
            <span
              key={i}
              style={{
                width: 2,
                background: 'var(--coral)',
                borderRadius: 2,
                ['--h' as string]: `${6 + ((i * 11) % 22)}px`,
                animation: `wave-bar ${0.7 + (i % 4) * 0.12}s ease ${i * 0.05}s infinite`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    )
  }
  if (cardId === 'file') {
    return (
      <div
        style={{
          width: 108,
          height: 138,
          background: '#171717',
          border: '1px solid var(--border-bright)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          padding: '18px 14px',
        }}
      >
        {[78, 56, 88, 64, 72, 60].map((w, i) => (
          <div key={i} style={{ height: 2, width: `${w}%`, background: 'var(--text-dim)' }} />
        ))}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 18,
            height: 18,
            background: 'var(--bg)',
            borderLeft: '1px solid var(--border-bright)',
            borderBottom: '1px solid var(--border-bright)',
          }}
        />
      </div>
    )
  }
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--text-muted)' }}>›</span>
      <span style={{ width: 14, height: 38, background: 'var(--coral)', animation: 'blink 1.1s infinite' }} />
    </div>
  )
}

function cardBg(c: InputMode): string {
  if (c === 'mic') {
    return 'radial-gradient(circle at 50% 60%, rgba(255,61,46,0.05), transparent 70%), #0B0B0B'
  }
  if (c === 'file') {
    return 'repeating-linear-gradient(to bottom, transparent 0 22px, rgba(255,255,255,0.025) 22px 23px), #0B0B0B'
  }
  return 'linear-gradient(180deg, #0B0B0B 0%, #0E0E0E 100%)'
}
