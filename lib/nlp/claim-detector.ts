const OPINION_MARKERS = [
  'i think',
  'i believe',
  'i feel',
  'in my opinion',
  'imo',
  'it seems',
  'probably',
  'maybe',
  'perhaps',
  'i guess',
  'apparently',
  'arguably',
]

const FUTURE_MARKERS = ['will be', 'going to', "won't", 'shall', 'someday', 'in the future']

const SPECIFIC_HINTS = [
  /\d+(\.\d+)?\s*(%|percent|million|billion|trillion|thousand)/i,
  /\b(in|since|before|after)\s+\d{4}/i,
  /\b\d+(\.\d+)?\s*(degrees?|°c|°f|km|miles|years?)/i,
]

export function isLikelyCheckworthy(sentence: string): boolean {
  const s = sentence.trim().toLowerCase()
  if (!s) return false
  if (s.endsWith('?')) return false
  for (const m of OPINION_MARKERS) if (s.startsWith(m) || s.includes(` ${m} `)) return false
  for (const m of FUTURE_MARKERS) if (s.includes(m)) return false
  for (const r of SPECIFIC_HINTS) if (r.test(sentence)) return true
  return s.split(/\s+/).length >= 6
}
