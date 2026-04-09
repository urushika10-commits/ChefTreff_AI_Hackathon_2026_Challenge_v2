export type Role = 'business' | 'developer'

export type ModeId =
  | 'spec-translator'
  | 'code-explorer'
  | 'task-generator'
  | 'change-explainer'
  | 'biz-qa'
  | 'docs-helper'

export interface Mode {
  id: ModeId
  label: string
  icon: string
  description: string
  inputLabel: string
  inputPlaceholder: string
  outputLabel: string
  primaryRoles: Role[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  thinking?: string
}

export interface RepoFile {
  path: string
  name: string
  type: 'file' | 'dir'
  size?: number
}

export interface LoadedFile {
  path: string
  content: string
}

export interface Settings {
  apiKey: string
  githubToken: string
  repoOwner: string
  repoName: string
}

export interface UploadedTextFile {
  name: string
  content: string
}

export interface UploadedImage {
  name: string
  mimeType: string
  base64: string
  previewUrl: string
}

export interface UploadedFiles {
  textFiles: UploadedTextFile[]
  images: UploadedImage[]
}

export interface AppState {
  role: Role | null
  activeMode: ModeId
  settings: Settings
  repoFiles: LoadedFile[]
  repoLoaded: boolean
  chatOpen: boolean
}

// ── Load Log ──────────────────────────────────────────────────────────────────

export type LogSource = 'repo-autoload' | 'repo-browser' | 'file-upload' | 'zip-extract'
export type LogStatus = 'success' | 'error' | 'warning' | 'skipped'

export interface LogEntry {
  id: string
  timestamp: Date
  source: LogSource
  filename: string
  path?: string
  status: LogStatus
  /** Raw technical info (HTTP status, exception message, byte count, etc.) */
  technicalDetail?: string
  /** Human-friendly one-liner that makes sense to a non-developer */
  plainExplanation: string
  sizeBytes?: number
}

/** Call this to push a new entry; id + timestamp are stamped automatically */
export type LogCallback = (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void
