import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { ChatGroq } from '@langchain/groq'

/**
 * Minimal LLM contract used by every agent. Both `ChatGoogleGenerativeAI`
 * and `ChatGroq` satisfy this shape (duck-typed); so does ResilientLLM below.
 */
export interface LLM {
  invoke(prompt: string): Promise<{ content: unknown }>
}

function isQuotaError(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? String(err)).toLowerCase()
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('429') ||
    msg.includes('too many requests') ||
    msg.includes('exhausted')
  )
}

/**
 * Tries Gemini first; on quota/rate-limit errors transparently falls back
 * to Groq Llama (also free tier). Once Gemini fails for a given LLM
 * instance we stay on Groq for subsequent calls to avoid burning latency
 * on guaranteed-failing requests.
 */
export class ResilientLLM implements LLM {
  private geminiBlocked = false
  private groq: ChatGroq | null = null

  constructor(
    private gemini: ChatGoogleGenerativeAI,
    private groqApiKey: string | undefined,
  ) {}

  private async getGroq(): Promise<ChatGroq | null> {
    if (this.groq) return this.groq
    if (!this.groqApiKey) return null
    const { ChatGroq } = await import('@langchain/groq')
    this.groq = new ChatGroq({
      apiKey: this.groqApiKey,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      maxTokens: 2048,
    })
    return this.groq
  }

  async invoke(prompt: string): Promise<{ content: unknown }> {
    if (!this.geminiBlocked) {
      try {
        return await this.gemini.invoke(prompt)
      } catch (err) {
        if (!isQuotaError(err)) throw err
        console.warn('[llm] Gemini quota exceeded, falling back to Groq:', (err as Error).message)
        this.geminiBlocked = true
      }
    }
    const groq = await this.getGroq()
    if (!groq) {
      throw new Error('Gemini quota exceeded and GROQ_API_KEY is not configured for fallback')
    }
    return groq.invoke(prompt)
  }
}

export function createResilientLLM(): ResilientLLM {
  const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!geminiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set')
  const gemini = new ChatGoogleGenerativeAI({
    apiKey: geminiKey,
    model: 'gemini-2.0-flash',
    temperature: 0.1,
    maxOutputTokens: 2048,
  })
  return new ResilientLLM(gemini, process.env.GROQ_API_KEY)
}
