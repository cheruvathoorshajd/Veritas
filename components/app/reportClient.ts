import type { Speaker, TranscriptLine, Verdict } from '@/lib/types'

export function generateReportClient(
  verdicts: Verdict[],
  transcriptLines: TranscriptLine[],
): Speaker[] {
  const ids = new Set<string>()
  for (const l of transcriptLines) ids.add(l.speaker)
  for (const v of verdicts) ids.add(v.speaker)

  const result: Speaker[] = []
  for (const id of ids) {
    const mine = verdicts.filter((v) => v.speaker === id)
    const claimsTotal = mine.length
    const claimsVerified = mine.filter((v) => v.label === 'VERIFIED').length
    const claimsFalse = mine.filter((v) => v.label === 'FALSE').length
    const claimsMisleading = mine.filter((v) => v.label === 'MISLEADING').length
    const claimsUnverified = mine.filter((v) => v.label === 'UNVERIFIED').length
    const accuracyPct =
      claimsTotal === 0 ? 0 : Math.round((claimsVerified / claimsTotal) * 100)
    result.push({
      id,
      label: `Speaker ${id}`,
      claimsTotal,
      claimsVerified,
      claimsFalse,
      claimsMisleading,
      claimsUnverified,
      accuracyPct,
    })
  }
  result.sort((a, b) => b.claimsTotal - a.claimsTotal || a.id.localeCompare(b.id))
  return result
}
