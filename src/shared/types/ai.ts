/**
 * OpenRouter AI configuration and message types.
 */
export interface AIConfig {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface AICompletionRequest {
  messages: ChatMessage[]
  config?: Partial<AIConfig>
}

export interface AIStreamChunk {
  requestId: string
  delta: string
  done: boolean
}

export interface AIError {
  requestId: string
  message: string
  retryable: boolean
}
