'use client'

import type { Evidence } from '@/lib/types'

/**
 * Split-view evidence panel rendered on CONTESTED verdicts (Phase 4E).
 * Left column = supporting evidence; right column = counter-evidence.
 * When no counter-evidence exists, shows "None found · Verdict stands".
 */
export function CounterEvidence({
  supporting,
  counter,
}: {
  supporting: Evidence[]
  counter: Evidence[]
}) {
  return (
    <div
      style={{
        marginTop: 16,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        borderTop: '1px solid var(--border-bright)',
        paddingTop: 14,
      }}
    >
      <EvidenceColumn
        title="SUPPORTING"
        accent="var(--teal)"
        empty="None"
        items={supporting}
      />
      <EvidenceColumn
        title="COUNTER"
        accent="var(--violet)"
        empty="None found · Verdict stands"
        items={counter}
      />
    </div>
  )
}

function EvidenceColumn({
  title,
  accent,
  empty,
  items,
}: {
  title: string
  accent: string
  empty: string
  items: Evidence[]
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: 2,
          color: accent,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{empty}</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.slice(0, 4).map((e, i) => (
            <li
              key={`${e.url}-${i}`}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: '1px dashed var(--border)',
              }}
            >
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 13,
                  color: 'var(--text)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1.2,
                }}
              >
                {e.source}
              </a>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: 1.2,
                  marginTop: 2,
                }}
              >
                {e.stance} · CRED {e.credibilityScore}
              </div>
              {e.excerpt && (
                <p
                  style={{
                    fontSize: 12,
                    color: '#666',
                    marginTop: 6,
                    lineHeight: 1.5,
                  }}
                >
                  {e.excerpt.length > 220
                    ? `${e.excerpt.slice(0, 220)}…`
                    : e.excerpt}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
