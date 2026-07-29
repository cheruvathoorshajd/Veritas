'use client'

import type { ExtractedClaim, Verdict, VerdictLabel } from '@/lib/types'
import { buildGenealogy, propagateFalseWarnings } from '@/lib/genealogy/graph'

const VERDICT_COLOR: Record<VerdictLabel, string> = {
  VERIFIED: 'var(--teal)',
  FALSE: 'var(--coral)',
  MISLEADING: 'var(--amber)',
  UNVERIFIED: 'var(--gray-v)',
  CONTESTED: 'var(--violet)',
}

/**
 * A lightweight genealogy visualisation. The full sprint spec calls for
 * a D3 force-directed graph; this is the minimum-viable version that
 * makes the genealogy data useful without adding a heavy dep — a list of
 * connections grouped by node, sized by edge weight, with the
 * cross-entity FALSE warnings flagged inline.
 *
 * Returns null when there are no claims with linkable entities — the
 * section header upstream handles the empty case.
 */
export function Genealogy({
  claims,
  verdicts,
}: {
  claims: ExtractedClaim[]
  verdicts: Verdict[]
}) {
  if (claims.length < 2) return null
  const { nodes, edges } = buildGenealogy(claims, verdicts)
  if (edges.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          letterSpacing: 1.2,
          color: 'var(--text-muted)',
          padding: '14px 0',
        }}
      >
        No cross-claim links detected.
      </div>
    )
  }
  const warnings = propagateFalseWarnings(claims, verdicts)
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  // Show the strongest 12 edges; deeper analysis lives in the JSON export.
  const top = [...edges].sort((a, b) => b.weight - a.weight).slice(0, 12)

  return (
    <div style={{ padding: '14px 0 28px' }}>
      <div
        style={{
          display: 'grid',
          gap: 12,
          maxWidth: 980,
        }}
      >
        {top.map((edge, i) => {
          const a = nodeById.get(edge.from)
          const b = nodeById.get(edge.to)
          if (!a || !b) return null
          const aWarn = warnings.has(a.id)
          const bWarn = warnings.has(b.id)
          return (
            <div
              key={`${edge.from}-${edge.to}-${i}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 1fr',
                gap: 14,
                alignItems: 'center',
                padding: '12px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <ClaimSummary node={a} warn={aWarn} side="left" />
              <EdgeIndicator weight={edge.weight} shared={edge.sharedEntities} />
              <ClaimSummary node={b} warn={bWarn} side="right" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClaimSummary({
  node,
  warn,
  side,
}: {
  node: { id: string; label: string; verdict: VerdictLabel; speaker: string; entities: string[] }
  warn: boolean
  side: 'left' | 'right'
}) {
  const color = VERDICT_COLOR[node.verdict]
  return (
    <div style={{ textAlign: side === 'left' ? 'right' : 'left' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: 1.5,
          color,
          marginBottom: 4,
          display: 'flex',
          justifyContent: side === 'left' ? 'flex-end' : 'flex-start',
          gap: 8,
        }}
      >
        <span>{node.verdict}</span>
        <span style={{ color: 'var(--text-muted)' }}>SPEAKER {node.speaker}</span>
        {warn && (
          <span
            title="Same speaker has a FALSE claim referencing this entity"
            style={{
              border: '1px solid var(--coral)',
              color: 'var(--coral)',
              padding: '0 6px',
              fontSize: 9,
              letterSpacing: 1.5,
            }}
          >
            ⚠ TAINT
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text)',
          lineHeight: 1.5,
        }}
      >
        {node.label.length > 110 ? node.label.slice(0, 110) + '…' : node.label}
      </div>
    </div>
  )
}

function EdgeIndicator({ weight, shared }: { weight: number; shared: string[] }) {
  const thickness = Math.max(1, Math.min(5, Math.round(weight * 5)))
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
      title={shared.length > 0 ? `Shared: ${shared.join(', ')}` : `Token overlap ${(weight * 100).toFixed(0)}%`}
    >
      <span
        aria-hidden
        style={{
          width: '100%',
          height: thickness,
          background: 'var(--violet)',
          opacity: 0.45 + weight * 0.4,
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.5,
          color: 'var(--text-muted)',
        }}
      >
        {Math.round(weight * 100)}%
      </span>
    </div>
  )
}
