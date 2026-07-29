import * as fs from 'fs'
import * as path from 'path'
const envPath = path.resolve(__dirname, '..', '.env.local')
const envText = fs.readFileSync(envPath, 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m) process.env[m[1]] = m[2]
}
import { parseTranscriptFromText } from '@/lib/transcription/web-speech'
import { extractClaims } from '@/lib/agents/claim-extraction'
import { createResilientLLM } from '@/lib/agents/llm'
import { isLikelyCheckworthy } from '@/lib/nlp/claim-detector'

const raw = `A
Birds.

0:04
A
Are a group of warm-blooded vertebrae animals constituting the class Avis.

0:17
A
Characterized by feathers, toothless jaws.

0:23
A
The Laying of Heart shelled eggs, a high metabolic rate, food chambered heart and a strong yet lightweight skeleton.

0:32
A
Bird's love worldwide and the range in size from 5.5 centimeter B hummingbird to 2.8 meter common ostrich.

0:43
A
There are over 11,000 living species and they are split into 44 orders.

0:49
A
More than half of these Passerinian or perching birds.

0:55
A
Having wings whose development varies across the species. The only known group without wings are the extinct MOA and elephant birds.

1:05
A
Wings which are modified, Foleyns gave birth the ability to fly, although further evolve evolution.

1:15
A
Has led to the loss of flight and sunbaths.

1:20
A
Including ratties, penguins and I was endemic Icelandic species.`

const lines = parseTranscriptFromText(raw)
console.log('=== PARSED LINES ===')
console.log('count:', lines.length)
for (const l of lines) {
  const passes = isLikelyCheckworthy(l.text)
  console.log(`[${l.speaker}] ${l.timestamp} pass=${passes} :: ${JSON.stringify(l.text)}`)
}

async function main() {
  console.log('\n=== CALLING EXTRACT CLAIMS ===')
  try {
    const model = createResilientLLM()
    const claims = await extractClaims(lines, model)
    console.log('claims count:', claims.length)
    for (const c of claims) {
      console.log(`- [${c.speaker}] ${c.timestamp} :: ${c.claimText}`)
    }
  } catch (e) {
    console.error('ERROR:', e)
  }
}
main()

