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

export interface AppState {
  role: Role | null
  activeMode: ModeId
  settings: Settings
  repoFiles: LoadedFile[]
  repoLoaded: boolean
  chatOpen: boolean
}
