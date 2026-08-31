// lib/ai/models.ts
import Anthropic from '@anthropic-ai/sdk'

// Single source of truth for the model every AI pipeline in this app calls —
// previously duplicated as a string literal in 6 separate files.
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 30_000,
      maxRetries: 1,
    })
  }
  return _anthropic
}
