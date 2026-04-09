import { useState, useCallback } from 'react'
import type { AppState, ModeId, Role, Settings } from './lib/types'
import RoleSelector from './components/RoleSelector'
import Layout from './components/Layout'

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  githubToken: '',
  repoOwner: '',
  repoName: '',
}

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem('bridgeai_settings')
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [state, setState] = useState<AppState>({
    role: null,
    activeMode: 'biz-qa',
    settings: loadSettings(),
    repoFiles: [],
    repoLoaded: false,
    chatOpen: true,
  })

  const setRole = useCallback((role: Role) => {
    setState((s) => ({
      ...s,
      role,
      activeMode: role === 'business' ? 'biz-qa' : 'code-explorer',
    }))
  }, [])

  const setActiveMode = useCallback((mode: ModeId) => {
    setState((s) => ({ ...s, activeMode: mode }))
  }, [])

  const saveSettings = useCallback((settings: Settings) => {
    localStorage.setItem('bridgeai_settings', JSON.stringify(settings))
    setState((s) => ({ ...s, settings }))
  }, [])

  const setRepoContext = useCallback(
    (files: import('./lib/types').LoadedFile[], loaded: boolean) => {
      setState((s) => ({ ...s, repoFiles: files, repoLoaded: loaded }))
    },
    [],
  )

  const toggleChat = useCallback(() => {
    setState((s) => ({ ...s, chatOpen: !s.chatOpen }))
  }, [])

  if (!state.role) {
    return <RoleSelector onSelectRole={setRole} />
  }

  return (
    <Layout
      state={state}
      onSetMode={setActiveMode}
      onSaveSettings={saveSettings}
      onSetRepoContext={setRepoContext}
      onToggleChat={toggleChat}
      onChangeRole={() => setState((s) => ({ ...s, role: null }))}
    />
  )
}
