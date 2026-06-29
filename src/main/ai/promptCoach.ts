import type { AIConfig, ChatMessage, PromptCoachResult } from '@shared/types'
import { OpenRouterClient } from './openRouterClient'

const SYSTEM_PROMPT = `You are VibeDuck's Prompt Coach. Analyze the user's prompt and return
ONLY valid minified JSON (no markdown fences) matching exactly this TypeScript type:
{
  "improvedPrompt": string,
  "missingContext": string[],
  "betterStructure": string,
  "constraints": string[],
  "examples": string[],
  "outputFormat": string,
  "score": { "clarity": number, "context": number, "structure": number, "constraints": number, "overall": number }
}
Scores are 0-100 integers. Be concise, practical, and teach the user to write better prompts.`

/**
 * Flagship feature. Wraps a chat completion in a strict JSON contract and
 * defensively parses the model output into a typed PromptCoachResult.
 */
export class PromptCoach {
  constructor(private readonly client: OpenRouterClient) {}

  async analyze(prompt: string, config: AIConfig): Promise<PromptCoachResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analyze and improve this prompt:\n\n"""${prompt}"""` }
    ]
    const raw = await this.client.complete(messages, config)
    return parseResult(raw)
  }

  /**
   * Returns ONLY the rewritten prompt text — used by Prompt Boost to drop the
   * improved prompt straight back into the user's chat box before it's sent.
   */
  async improve(prompt: string, config: AIConfig): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: IMPROVE_PROMPT },
      { role: 'user', content: prompt }
    ]
    const raw = await this.client.complete(messages, config)
    return cleanImproved(raw, prompt)
  }
}

const IMPROVE_PROMPT = `You are VibeDuck's Prompt Booster. Rewrite the user's prompt so an AI coding
assistant produces the best possible result: make the intent explicit, add relevant context and
constraints, and structure it clearly. Keep the user's original language and meaning. Do NOT answer
the prompt or add commentary, preamble, or quotes — output ONLY the improved prompt text.`

/** Strip fences/quotes a model might wrap around the rewrite; fall back to original. */
function cleanImproved(raw: string, fallback: string): string {
  let text = raw.trim()
  const fenced = text.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  if (fenced) text = fenced[1].trim()
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    text = text.slice(1, -1).trim()
  }
  return text || fallback
}

function parseResult(raw: string): PromptCoachResult {
  const json = extractJson(raw)
  const parsed = JSON.parse(json) as Partial<PromptCoachResult>
  return {
    improvedPrompt: parsed.improvedPrompt ?? '',
    missingContext: parsed.missingContext ?? [],
    betterStructure: parsed.betterStructure ?? '',
    constraints: parsed.constraints ?? [],
    examples: parsed.examples ?? [],
    outputFormat: parsed.outputFormat ?? '',
    score: {
      clarity: parsed.score?.clarity ?? 0,
      context: parsed.score?.context ?? 0,
      structure: parsed.score?.structure ?? 0,
      constraints: parsed.score?.constraints ?? 0,
      overall: parsed.score?.overall ?? 0
    }
  }
}

/** Models sometimes wrap JSON in prose or fences; pull out the first JSON object. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1)
  return raw.trim()
}
