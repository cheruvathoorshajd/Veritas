'use client'

export function ExportButton({ sessionId }: { sessionId?: string }) {
  if (!sessionId) return null
  return (
    <button
      type="button"
      onClick={() => window.open(`/api/session/${sessionId}/report`, '_blank')}
      style={{
        marginTop: 24,
        padding: '12px 22px',
        background: 'transparent',
        border: '1px solid var(--text-dim)',
        color: 'var(--text)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        letterSpacing: 1.5,
        cursor: 'pointer',
      }}
    >
      DOWNLOAD REPORT →
    </button>
  )
}
