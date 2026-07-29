'use client'

import type { Session, Speaker, TranscriptLine, Verdict, ExtractedClaim } from '@/lib/types'
import { renderReportHtml } from '@/lib/report/render'

export function ExportButton({
  sessionId,
  transcriptLines,
  claims,
  verdicts,
  speakers,
  inputMode,
}: {
  sessionId?: string
  transcriptLines: TranscriptLine[]
  claims: ExtractedClaim[]
  verdicts: Verdict[]
  speakers: Speaker[]
  inputMode: Session['inputMode']
}) {
  if (!verdicts.length) return null

  const download = () => {
    const session: Session = {
      id: sessionId ?? '',
      createdAt: new Date().toISOString(),
      inputMode,
      stage: 'complete',
      error: null,
      transcriptLines,
      claims,
      verdicts,
      speakers,
    }
    const html = renderReportHtml(session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `veritas-report-${stamp}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <button
      type="button"
      onClick={download}
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
