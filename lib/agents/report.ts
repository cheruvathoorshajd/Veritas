import { traceable } from 'langsmith/traceable'
import type { Speaker, TranscriptLine, Verdict } from '@/lib/types'

function generateReportImpl(
  verdicts: Verdict[],
  transcriptLines: TranscriptLine[],
): Speaker[] {
  const speakerIds = new Set<string>()
  for (const l of transcriptLines) speakerIds.add(l.speaker)
  for (const v of verdicts) speakerIds.add(v.speaker)

  const speakers: Speaker[] = []
  for (const id of speakerIds) {
    const mine = verdicts.filter((v) => v.speaker === id)
    const claimsTotal = mine.length
    const claimsVerified = mine.filter((v) => v.label === 'VERIFIED').length
    const claimsFalse = mine.filter((v) => v.label === 'FALSE').length
    const claimsMisleading = mine.filter((v) => v.label === 'MISLEADING').length
    const claimsUnverified = mine.filter((v) => v.label === 'UNVERIFIED').length
    const accuracyPct =
      claimsTotal === 0 ? 0 : Math.round((claimsVerified / claimsTotal) * 100)
    speakers.push({
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

  speakers.sort((a, b) => b.claimsTotal - a.claimsTotal || a.id.localeCompare(b.id))
  return speakers
}

export const generateReport = traceable(
  async (verdicts: Verdict[], transcriptLines: TranscriptLine[]) =>
    generateReportImpl(verdicts, transcriptLines),
  { name: 'veritas:report-generation', project_name: 'veritas' },
)
