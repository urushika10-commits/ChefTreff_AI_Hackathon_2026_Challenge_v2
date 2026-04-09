import { useState, useCallback } from 'react'
import type { AppState, ModeId, Settings, LoadedFile, LogEntry, LogCallback } from '../lib/types'
import ModeSidebar from './ModeSidebar'
import ModePanel from './ModePanel'
import ChatSidebar from './ChatSidebar'
import SettingsModal from './SettingsModal'
import RepoBrowser from './RepoBrowser'
import LoadLog from './LoadLog'
import LoadToast from './LoadToast'

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
  const [showBrowser, setShowBrowser] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])

  const addLog = useCallback<LogCallback>((entry) => {
    setLogs((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: new Date() },
      ...prev,
    ])
  }, [])

  const role = state.role!
  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const bg = role === 'business' ? '#060D1F' : '#090612'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const lightColor = role === 'business' ? '#93C5FD' : '#D8B4FE'
  const roleLabel = role === 'business' ? 'Business Analyst Mode' : 'Developer Mode'
  const repoName =
    state.settings.repoOwner && state.settings.repoName
      ? `${state.settings.repoOwner}/${state.settings.repoName}`
      : null

  const headerBtnStyle: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: '#94A3B8',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#F1F5F9',
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          height: 60,
          background: surface,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          gap: 16,
        }}
      >
        {/* Logo */}
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #3B82F6, #A855F7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            flexShrink: 0,
          }}
        >
          DualMind AI
        </span>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)' }} />

        {/* Role badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 100,
            fontSize: 12,
            fontWeight: 600,
            background: `${primary}26`,
            color: lightColor,
            border: `1px solid ${border}`,
          }}
        >
          <span
            className="pulse-dot"
            style={{ width: 7, height: 7, borderRadius: '50%', background: primary, display: 'inline-block' }}
          />
          {roleLabel}
        </div>

        <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 400 }}>Loan Calculator Project</span>

        <div style={{ flex: 1 }} />

        {/* Repo pill */}
        {repoName && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12,
              color: '#94A3B8',
            }}
          >
            📂 {repoName}
            {state.repoLoaded && (
              <span style={{ color: '#10B981' }}>({state.repoFiles.length})</span>
            )}
          </div>
        )}

        {/* Browse repo button — only when a repo is configured */}
        {repoName && (
          <button
            style={{ ...headerBtnStyle, color: state.repoLoaded ? primary : '#94A3B8' }}
            onClick={() => setShowBrowser(true)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = state.repoLoaded ? primary : '#94A3B8' }}
          >
            🗂 Browse
          </button>
        )}

        {/* Load log button */}
        <button
          style={{
            ...headerBtnStyle,
            position: 'relative',
            color: logs.some((l) => l.status === 'error') ? '#EF4444' : '#94A3B8',
          }}
          onClick={() => setShowLog(true)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = logs.some((l) => l.status === 'error') ? '#EF4444' : '#94A3B8'
          }}
        >
          📋 Log
          {logs.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                background: logs.some((l) => l.status === 'error') ? '#EF4444' : primary,
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              {logs.length > 99 ? '99+' : logs.length}
            </span>
          )}
        </button>

        {/* No API key warning */}
        {!state.settings.apiKey && (
          <span style={{ fontSize: 12, color: '#F59E0B' }}>⚠️ No API key</span>
        )}

        {/* Header buttons */}
        <button
          style={headerBtnStyle}
          onClick={onToggleChat}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          {state.chatOpen ? '▶ Hide Chat' : '◀ Chat'}
        </button>

        <button
          style={headerBtnStyle}
          onClick={() => setShowSettings(true)}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          ⚙️ Settings
        </button>

        <button
          style={headerBtnStyle}
          onClick={onChangeRole}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' }}
        >
          ↩ Switch Role
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Feature area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: '#475569',
              paddingBottom: 4,
            }}
          >
            Quick Actions — select a mode
          </p>

          {/* Mode tile grid */}
          <ModeSidebar
            activeMode={state.activeMode}
            role={role}
            onSelectMode={onSetMode}
          />

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

          {/* Active mode work panel */}
          <ModePanel
            key={state.activeMode}
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            repoLoaded={state.repoLoaded}
            onSetRepoContext={onSetRepoContext}
            onOpenSettings={() => setShowSettings(true)}
            onLog={addLog}
          />
        </div>

        {/* Chat sidebar */}
        {state.chatOpen && (
          <ChatSidebar
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            onOpenSettings={() => setShowSettings(true)}
            onLog={addLog}
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

      {showBrowser && state.settings.repoOwner && state.settings.repoName && (
        <RepoBrowser
          settings={state.settings}
          role={role}
          alreadyLoaded={state.repoFiles.map((f) => f.path)}
          onLoad={(files) => onSetRepoContext(files, true)}
          onClose={() => setShowBrowser(false)}
          onLog={addLog}
        />
      )}

      {showLog && (
        <LoadLog
          logs={logs}
          role={role}
          settings={state.settings}
          onClear={() => setLogs([])}
          onClose={() => setShowLog(false)}
        />
      )}

      {/* Live loading toast — always rendered, self-shows/hides */}
      <LoadToast logs={logs} role={role} />
    </div>
  )
}
