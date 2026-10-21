// scripts/cover-letter-eval/probe.ts
// One-off check of what the cover letter writer can rely on: structured
// output (a Zod schema) together with extended thinking, on the app's model
// and on Haiku 5.5. Haiku 4.5 takes a manual thinking budget and no effort
// parameter; Haiku 5.5 takes adaptive thinking and effort and rejects a budget.
// Run from cv-builder/: npx tsx scripts/cover-letter-eval/probe.ts  (under $0.01)
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { DEFAULT_MODEL } from '@/lib/ai/models'

const Out = z.object({
  sentence: z.string(),
  facts: z.array(z.string()),
})

const PROMPT =
  'Facts: F1 "Cut report time by 40% at Acme". F2 "Led a team of 4 analysts at Acme". ' +
  'Write one cover-letter sentence using only these facts, and list the fact IDs it uses. ' +
  'Before answering, check that every number keeps its meaning.'

type Config = { label: string; params: Record<string, unknown> }

const CONFIGS: Config[] = [
  { label: `${DEFAULT_MODEL}: thinking (budget 2000) + structured output`, params: { model: DEFAULT_MODEL, max_tokens: 4000, thinking: { type: 'enabled', budget_tokens: 2000 } } },
  { label: `${DEFAULT_MODEL}: structured output, no thinking`, params: { model: DEFAULT_MODEL, max_tokens: 1000 } },
  { label: 'claude-haiku-5-5: adaptive thinking (effort medium) + structured output', params: { model: 'claude-haiku-5-5', max_tokens: 4000, thinking: { type: 'adaptive' }, effortLevel: 'medium' } },
]

async function main() {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // the environment may already carry the variables
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 0 })
  for (const { label, params } of CONFIGS) {
    const { effortLevel, ...rest } = params as { effortLevel?: string } & Record<string, unknown>
    const outputConfig = { format: zodOutputFormat(Out), ...(effortLevel ? { effort: effortLevel } : {}) }
    const started = Date.now()
    try {
      const res = await client.messages.parse({
        ...(rest as unknown as Anthropic.MessageCreateParamsNonStreaming),
        output_config: outputConfig as Anthropic.MessageCreateParams['output_config'],
        messages: [{ role: 'user', content: PROMPT }],
      })
      const kinds = res.content.map((b) => b.type).join(', ')
      console.log(`OK   ${label}\n     ${Date.now() - started} ms, stop ${res.stop_reason}, blocks [${kinds}], usage in ${res.usage.input_tokens} / out ${res.usage.output_tokens}`)
      console.log(`     parsed: ${JSON.stringify(res.parsed_output)}`)
    } catch (err) {
      const message = err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : String(err)
      console.log(`FAIL ${label}\n     ${Date.now() - started} ms: ${message.slice(0, 300)}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
