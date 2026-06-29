import { newId } from '@shared/utils'
import type { AIConfig, ChatMessage } from '@shared/types'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_TIMEOUT_MS = 60_000
const MAX_RETRIES = 2

export interface StreamHandlers {
  onDelta: (delta: string) => void
  onDone: () => void
  onError: (message: string, retryable: boolean) => void
}

/**
 * Thin OpenRouter client. Handles streaming SSE, timeouts and basic retry of
 * transient failures. The user's API key is supplied per call by the caller
 * (decrypted from secure storage) and never persisted here.
 */
export class OpenRouterClient {
  async complete(messages: ChatMessage[], config: AIConfig): Promise<string> {
    let buffer = ''
    await this.stream(messages, config, {
      onDelta: (d) => (buffer += d),
      onDone: () => undefined,
      onError: (message) => {
        throw new Error(message)
      }
    })
    return buffer
  }

  async stream(messages: ChatMessage[], config: AIConfig, handlers: StreamHandlers): Promise<void> {
    let attempt = 0
    while (attempt <= MAX_RETRIES) {
      try {
        await this.streamOnce(messages, config, handlers)
        return
      } catch (error) {
        const retryable = isRetryable(error)
        if (!retryable || attempt === MAX_RETRIES) {
          handlers.onError(errorMessage(error), retryable)
          return
        }
        attempt += 1
        await delay(250 * attempt)
      }
    }
  }

  private async streamOnce(
    messages: ChatMessage[],
    config: AIConfig,
    handlers: StreamHandlers
  ): Promise<void> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'HTTP-Referer': 'https://vibeduck.app',
          'X-Title': 'VibeDuck'
        },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: true,
          messages
        })
      })

      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '')
        throw new HttpError(response.status, text || response.statusText)
      }

      await consumeSse(response.body, handlers.onDelta)
      handlers.onDone()
    } finally {
      clearTimeout(timeout)
    }
  }
}

/** Parses an OpenAI/OpenRouter compatible SSE stream of chat completion chunks. */
async function consumeSse(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch {
        // Ignore keep-alive comments and partial frames.
      }
    }
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500
  if (error instanceof Error && error.name === 'AbortError') return true
  return error instanceof TypeError // network failures
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown AI error'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function makeRequestId(): string {
  return newId()
}
