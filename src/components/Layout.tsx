import { useState } from 'react'
import type { AppState, ModeId, Settings, LoadedFile } from '../lib/types'
import ModeSidebar from './ModeSidebar'
import ModePanel from './ModePanel'
import ChatSidebar from './ChatSidebar'
import SettingsModal from './SettingsModal'

interface Props {
  state: AppState
  onSetMode: (mode: ModeId) => void
  onSaveSettings: (s: Settings) => void
  onSetRepoContext: (files: LoadedFile[], loaded: boolean) => void
  onToggleChat: () => void
  onChangeRole: () => void
}

export default function Layout({
  state,
  onSetMode,
  onSaveSettings,
  onSetRepoContext,
  onToggleChat,
  onChangeRole,
}: Props) {
  const [showSettings, setShowSettings] = useState(!state.settings.apiKey)

  const role = state.role!
  const accentColor = role === 'business' ? 'text-amber-400' : 'text-indigo-400'
  const accentBg = role === 'business' ? 'bg-amber-500/20' : 'bg-indigo-500/20'
  const roleLabel = role === 'business' ? '📊 Business Analyst' : '💻 Developer'

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Header */}
      <header className="h-12 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌉</span>
          <span className="font-bold text-white text-sm">BridgeAI</span>
        </div>

        <div className="h-4 w-px bg-slate-700" />

        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${accentBg} ${accentColor}`}>
          {roleLabel}
        </span>

        <div className="flex-1" />

        {/* Repo status */}
        {state.repoLoaded && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Repo loaded ({state.repoFiles.length} files)
          </span>
        )}

        {/* No API key warning */}
        {!state.settings.apiKey && (
          <span className="text-xs text-amber-400 flex items-center gap-1">
            ⚠️ No API key set
          </span>
        )}

        <button
          onClick={onToggleChat}
          title="Toggle chat panel"
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors text-sm"
        >
          {state.chatOpen ? '▶ Hide Chat' : '◀ Show Chat'}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors text-sm"
          title="Settings"
        >
          ⚙️
        </button>

        <button
          onClick={onChangeRole}
          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-md transition-colors text-xs"
          title="Switch role"
        >
          Switch Role
        </button>
      </header>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Mode sidebar */}
        <ModeSidebar
          activeMode={state.activeMode}
          role={role}
          onSelectMode={onSetMode}
        />

        {/* Center: Mode panel */}
        <main className="flex-1 overflow-hidden">
          <ModePanel
            key={state.activeMode}
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            repoLoaded={state.repoLoaded}
            onSetRepoContext={onSetRepoContext}
            onOpenSettings={() => setShowSettings(true)}
          />
        </main>

        {/* Right: Chat sidebar */}
        {state.chatOpen && (
          <ChatSidebar
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
      </div>

      {showSettings && (
        <SettingsModal
          settings={state.settings}
          onSave={onSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
