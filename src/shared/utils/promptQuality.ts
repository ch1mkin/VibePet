/**
 * Fast, local heuristic to judge whether a prompt looks well-formed for a task.
 * Used for live, no-API feedback as the user types into an AI chat box. For deep
 * analysis the user can still run the full Prompt Coach (OpenRouter).
 */
export type PromptLevel = 'weak' | 'ok' | 'good'

export interface PromptAssessment {
  level: PromptLevel
  tip: string
}

const TASK_VERB =
  /\b(create|build|make|fix|refactor|explain|generate|implement|write|add|optimize|debug|design|convert|translate|summari[sz]e|test|review|improve|analy[sz]e)\b/i

const CONTEXT_HINT =
  /\b(react|vue|svelte|next|node|typescript|javascript|python|rust|go|java|sql|api|endpoint|component|function|class|file|database|schema|css|tailwind|using|with|in\s+\w+|for\s+\w+)\b/i

const CONSTRAINT_HINT =
  /\b(must|should|only|don't|do not|avoid|ensure|return|output|format|step[- ]by[- ]step|example|constraint|requirement|edge case)\b/i

export function assessPrompt(raw: string): PromptAssessment {
  const text = raw.trim()
  const words = text.split(/\s+/).filter(Boolean)
  const len = words.length

  const hasVerb = TASK_VERB.test(text)
  const hasContext = CONTEXT_HINT.test(text)
  const hasConstraints = CONSTRAINT_HINT.test(text)

  if (len < 4) {
    return { level: 'weak', tip: 'Too short — say what you want & why' }
  }
  if (!hasVerb && len < 12) {
    return { level: 'weak', tip: "Start with an action: 'Refactor…', 'Explain…'" }
  }
  if (!hasContext) {
    return { level: 'ok', tip: 'Add context: language, file, framework?' }
  }
  if (!hasConstraints) {
    return { level: 'ok', tip: 'Nice! Add constraints or an example?' }
  }
  if (hasVerb && hasContext && hasConstraints && len >= 8) {
    return { level: 'good', tip: 'Looks solid! 👍' }
  }
  return { level: 'ok', tip: 'Good start — a bit more detail helps' }
}
