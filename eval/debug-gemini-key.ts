import * as fs from 'fs'
import * as path from 'path'

const envPath = path.resolve(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}

const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
if (!key) { console.error('no key'); process.exit(1) }
console.log('key prefix:', key.slice(0, 10), 'len:', key.length)

async function tryModel(model: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with the single word: OK' }] }],
    }),
  })
  console.log(`\n=== ${model} ===`)
  console.log('status:', res.status, res.statusText)
  const text = await res.text()
  console.log('body:', text.slice(0, 1500))
}

async function main() {
  for (const m of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.5-flash']) {
    try { await tryModel(m) } catch (e) { console.error(m, 'threw:', e) }
  }
}
main()
