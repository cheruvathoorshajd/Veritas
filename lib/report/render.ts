import type { Session, Verdict, VerdictLabel } from '@/lib/types'

const VERDICT_COLOR: Record<VerdictLabel, string> = {
  VERIFIED: '#00D98B',
  FALSE: '#FF3D2E',
  MISLEADING: '#FFAB00',
  UNVERIFIED: '#808080',
  CONTESTED: '#A78BFA',
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderVerdict(v: Verdict): string {
  const color = VERDICT_COLOR[v.label]
  const evidenceHtml = v.evidence
    .map(
      (e) => `
    <li>
      <strong>${esc(e.source)}</strong>
      <span style="color:#666"> · ${esc(e.stance)} · credibility ${e.credibilityScore}</span>
      <br>
      <a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.url)}</a>
      <p style="margin:6px 0 0; color:#333;">${esc(e.excerpt.slice(0, 600))}</p>
    </li>`,
    )
    .join('')
  return `
  <article style="padding:18px 0; border-bottom:1px solid #e5e5e5;">
    <header style="display:flex; align-items:baseline; gap:12px;">
      <div style="font-size:24px; font-weight:500; color:${color}; letter-spacing:-0.5px;">${esc(v.label)}</div>
      <div style="font-size:14px; color:#888;">${v.confidencePct}% confidence</div>
      <div style="margin-left:auto; font-family:ui-monospace, monospace; font-size:11px; color:#999;">Speaker ${esc(v.speaker)} · ${esc(v.timestamp)}</div>
    </header>
    <p style="margin:6px 0 12px; font-size:15px; color:#111;">&ldquo;${esc(v.claimText)}&rdquo;</p>
    <p style="margin:0 0 10px; color:#333;">${esc(v.explanation)}</p>
    ${
      v.evidence.length
        ? `<details><summary style="cursor:pointer; color:#555; font-size:12px;">Sources (${v.evidence.length})</summary><ul style="margin-top:8px; padding-left:18px; font-size:12px;">${evidenceHtml}</ul></details>`
        : ''
    }
  </article>`
}

function renderSpeakerTable(session: Session): string {
  if (!session.speakers.length) return ''
  const rows = session.speakers
    .map(
      (s) => `
    <tr>
      <td style="padding:6px 12px;">${esc(s.label)}</td>
      <td style="padding:6px 12px; text-align:right;">${s.claimsTotal}</td>
      <td style="padding:6px 12px; text-align:right; color:#00D98B;">${s.claimsVerified}</td>
      <td style="padding:6px 12px; text-align:right; color:#FF3D2E;">${s.claimsFalse}</td>
      <td style="padding:6px 12px; text-align:right; color:#FFAB00;">${s.claimsMisleading}</td>
      <td style="padding:6px 12px; text-align:right; color:#808080;">${s.claimsUnverified}</td>
      <td style="padding:6px 12px; text-align:right; font-weight:500;">${s.accuracyPct}%</td>
    </tr>`,
    )
    .join('')
  return `
  <table style="border-collapse:collapse; width:100%; font-size:13px; margin:14px 0 24px;">
    <thead>
      <tr style="border-bottom:1px solid #999; text-align:left;">
        <th style="padding:6px 12px;">Speaker</th>
        <th style="padding:6px 12px; text-align:right;">Claims</th>
        <th style="padding:6px 12px; text-align:right;">Verified</th>
        <th style="padding:6px 12px; text-align:right;">False</th>
        <th style="padding:6px 12px; text-align:right;">Misleading</th>
        <th style="padding:6px 12px; text-align:right;">Unverified</th>
        <th style="padding:6px 12px; text-align:right;">Accuracy</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`
}

export function renderReportHtml(session: Session): string {
  const grouped = new Map<string, Verdict[]>()
  for (const v of session.verdicts) {
    const arr = grouped.get(v.speaker) ?? []
    arr.push(v)
    grouped.set(v.speaker, arr)
  }
  for (const [, arr] of grouped) {
    arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }
  const speakerSections = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([speaker, arr]) =>
        `<section style="margin-top:22px;">
          <h2 style="font-size:16px; letter-spacing:2px; text-transform:uppercase; color:#222; border-bottom:1px solid #e5e5e5; padding-bottom:6px;">Speaker ${esc(speaker)}</h2>
          ${arr.map(renderVerdict).join('')}
        </section>`,
    )
    .join('')

  const created = new Date(session.createdAt).toLocaleString()
  const idLabel = session.id ? `Session ${esc(session.id)} · ` : ''

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Veritas Fact-Check Report${session.id ? ` — ${esc(session.id)}` : ''}</title>
<style>
  @media print { body { color: #000; } a { color: #000; text-decoration: underline; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; color:#111; max-width:860px; margin:40px auto; padding:0 24px; line-height:1.55; }
  h1 { font-size:30px; font-weight:500; letter-spacing:-1px; margin:0 0 4px; }
  .muted { color:#777; font-family:ui-monospace, monospace; font-size:12px; }
</style>
</head>
<body>
  <header>
    <h1>Veritas Fact-Check Report</h1>
    <div class="muted">${idLabel}${esc(created)} · ${session.verdicts.length} claims checked</div>
  </header>

  <h2 style="margin-top:28px; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:#555;">Per-speaker accuracy</h2>
  ${renderSpeakerTable(session)}

  <h2 style="margin-top:20px; font-size:14px; letter-spacing:2px; text-transform:uppercase; color:#555;">Verdicts</h2>
  ${speakerSections || '<p style="color:#777;">No verdicts recorded.</p>'}

  <footer style="margin-top:40px; padding-top:18px; border-top:1px solid #e5e5e5; color:#888; font-size:11px;">
    Generated by Veritas — the truth machine. Use your browser to print or save as PDF.
  </footer>
</body>
</html>`
}
