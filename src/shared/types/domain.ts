/**
 * Core domain models shared between main and renderer.
 * These mirror local SQLite rows and cloud Postgres tables.
 */

export type ID = string
export type ISODateString = string

export interface BaseRecord {
  id: ID
  userId: ID | null
  createdAt: ISODateString
  updatedAt: ISODateString
}

export type ClipboardCategory = 'code' | 'command' | 'url' | 'prompt' | 'text' | 'image'

export interface ClipboardItem extends BaseRecord {
  content: string
  category: ClipboardCategory
  pinned: boolean
  favorite: boolean
}

export type TaskStatus = 'active' | 'completed' | 'interrupted' | 'cancelled'

export interface Task extends BaseRecord {
  name: string
  status: TaskStatus
  startedAt: ISODateString
  endedAt: ISODateString | null
  durationMs: number
  promptUsed: string | null
  notes: string | null
  projectId: ID | null
}

export interface Project extends BaseRecord {
  name: string
  folder: string
  framework: string | null
  languages: string[]
  libraries: string[]
  architectureNotes: string | null
  folderStructure: string | null
  codingStyle: string | null
  currentGoal: string | null
  knownBugs: string[]
  todoList: string[]
  preferredModel: string | null
}

export interface PromptScore {
  clarity: number
  context: number
  structure: number
  constraints: number
  overall: number
}

export interface PromptCoachResult {
  improvedPrompt: string
  missingContext: string[]
  betterStructure: string
  constraints: string[]
  examples: string[]
  outputFormat: string
  score: PromptScore
}

export interface PromptHistoryItem extends BaseRecord {
  original: string
  improved: string | null
  category: string | null
  tags: string[]
  favorite: boolean
  score: number | null
}

export interface TimelineEntry extends BaseRecord {
  type: string
  label: string
  metadata: Record<string, string | number | boolean | null>
  occurredAt: ISODateString
}

export interface DailySummary extends BaseRecord {
  date: string
  hoursCoded: number
  tasksCompleted: number
  promptsImproved: number
  aiRequests: number
  clipboardItems: number
  linesGenerated: number
  streak: number
}

export interface Achievement extends BaseRecord {
  key: string
  unlockedAt: ISODateString | null
  progress: number
  target: number
}
