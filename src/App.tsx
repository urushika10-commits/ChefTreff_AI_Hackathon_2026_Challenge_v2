import { useState, useCallback } from 'react'
import type { AppState, ModeId, Role, Settings } from './lib/types'
import RoleSelector from './components/RoleSelector'
import ProjectSetup, { type SetupResult } from './components/ProjectSetup'
import Layout from './components/Layout'

type Step = 'role-select' | 'project-setup' | 'main'

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
  const [step, setStep]               = useState<Step>('role-select')
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [state, setState]             = useState<AppState>({
    role: null,
    activeMode: 'biz-qa',
    settings: loadSettings(),
    repoFiles: [],
    repoLoaded: false,
    chatOpen: true,
    specs: '',
  })

  // ── Step 1: role chosen → project setup ────────────────────────────────────
  const handleRoleSelect = useCallback((role: Role) => {
    setPendingRole(role)
    setStep('project-setup')
  }, [])

  // ── Step 2: setup done → main app ──────────────────────────────────────────
  const handleSetupComplete = useCallback((result: SetupResult) => {
    const role = pendingRole!
    const mergedSettings: Settings = {
      ...loadSettings(),
      ...state.settings,
      apiKey: state.settings.apiKey,
      ...result.settings,
    }
    localStorage.setItem('bridgeai_settings', JSON.stringify(mergedSettings))
    setState((s) => ({
      ...s,
      role,
      activeMode: role === 'business' ? 'biz-qa' : 'code-explorer',
      settings: mergedSettings,
      repoFiles: result.repoFiles,
      repoLoaded: result.repoLoaded,
      specs: result.specs,
    }))
    setStep('main')
  }, [pendingRole, state.settings])

  // ── In-app callbacks ────────────────────────────────────────────────────────
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

  // "Switch Role" resets to the beginning of the flow
  const handleChangeRole = useCallback(() => {
    setState((s) => ({ ...s, role: null, repoFiles: [], repoLoaded: false, specs: '' }))
    setPendingRole(null)
    setStep('role-select')
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────────
  if (step === 'role-select') {
    return <RoleSelector onSelectRole={handleRoleSelect} />
  }

  if (step === 'project-setup') {
    return (
      <ProjectSetup
        role={pendingRole!}
        existingSettings={state.settings}
        onComplete={handleSetupComplete}
        onBack={() => setStep('role-select')}
      />
    )
  }

  return (
    <Layout
      state={state}
      onSetMode={setActiveMode}
      onSaveSettings={saveSettings}
      onSetRepoContext={setRepoContext}
      onToggleChat={toggleChat}
      onChangeRole={handleChangeRole}
    />
  )
}
