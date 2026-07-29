// AssemblyAI emits speaker strings like "A"/"B"/"1"/"2".
// Normalise to canonical "A", "B", "C"... regardless of the source format.
export function normaliseSpeaker(
  raw: string | null | undefined,
  map: Map<string, string>,
): string {
  const key = (raw ?? 'A').toString()
  const existing = map.get(key)
  if (existing) return existing
  const idx = map.size
  const letter = String.fromCharCode(65 + (idx % 26))
  map.set(key, letter)
  return letter
}
