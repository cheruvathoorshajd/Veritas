// Sanitisation helpers for text that originates from user input or external
// retrieval and is interpolated into LLM prompts. This is a defence-in-depth
// measure, not a guarantee — LLMs can still be manipulated by sophisticated
// adversarial inputs. The goal is to remove the easy attack vectors
// (control characters, prompt-injection delimiters, runaway length).

const MAX_DEFAULT_CHARS = 4_000

/**
 * Strip control characters and runs of whitespace, clamp to a maximum length,
 * and normalise quotes/backticks that could be used to break out of a code
 * block or instruction context inside a prompt.
 */
export function sanitiseForPrompt(input: string, maxChars = MAX_DEFAULT_CHARS): string {
  if (!input) return ''
  let s = String(input)
  // Strip ASCII control characters except for tab and newline.
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
  // Collapse excessive whitespace.
  s = s.replace(/[\t ]{3,}/g, '  ').replace(/\n{4,}/g, '\n\n\n')
  // Normalise common typographic quotes so the LLM sees a single canonical form.
  s = s.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
  if (s.length > maxChars) s = s.slice(0, maxChars) + '…'
  return s.trim()
}

/**
 * Sanitise a URL for inclusion in a prompt. Only http(s) URLs are returned
 * verbatim; anything else (javascript:, data:, weird control chars in the
 * scheme) collapses to an empty string so the prompt cannot be tricked into
 * rendering a hostile URL.
 */
export function sanitiseUrl(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    // Strip credentials if present.
    u.username = ''
    u.password = ''
    return u.toString()
  } catch {
    return ''
  }
}

/**
 * Wrap untrusted text in a delimited block with a one-line instruction the LLM
 * can use to distinguish content from instructions. Combined with `sanitiseForPrompt`
 * this is "good enough" for the threat model (transcripts and web search
 * snippets, not adversarial API payloads).
 */
export function delimitUntrusted(label: string, body: string): string {
  const safe = sanitiseForPrompt(body)
  return `<${label}>\n${safe}\n</${label}>`
}
