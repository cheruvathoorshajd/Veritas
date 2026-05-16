/**
 * Shared helpers for parsing JSON out of LLM output. LLMs occasionally wrap
 * their JSON in ```json fences or sandwich it between explanatory prose;
 * these helpers normalise that so each agent doesn't have to reinvent the
 * extraction logic.
 */

/** Strips ```...``` and ```json...``` fences from a raw LLM string. */
export function stripFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  }
  return s.trim()
}

/**
 * Tries to extract a JSON array from a possibly-fenced, possibly-prose-wrapped
 * LLM response. Returns the parsed array on success, or `null` if no array
 * can be recovered.
 */
export function extractJsonArray<T = unknown>(text: string): T[] | null {
  const s = stripFence(text)
  if (!s) return null
  try {
    const parsed = JSON.parse(s)
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch {
    const match = s.match(/\[[\s\S]*\]/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return Array.isArray(parsed) ? (parsed as T[]) : null
    } catch {
      return null
    }
  }
}

/**
 * Tries to extract a JSON object from a possibly-fenced, possibly-prose-wrapped
 * LLM response. Returns the parsed object on success, or `null` if no object
 * can be recovered.
 */
export function extractJsonObject<T = unknown>(text: string): T | null {
  const s = stripFence(text)
  if (!s) return null
  try {
    const parsed = JSON.parse(s)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as T)
      : null
  } catch {
    const match = s.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as T)
        : null
    } catch {
      return null
    }
  }
}
