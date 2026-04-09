import { useState, useCallback } from 'react'
import type { AppState, ModeId, Settings, LoadedFile, LogEntry, LogCallback } from '../lib/types'
import ModeSidebar from './ModeSidebar'
import ModePanel from './ModePanel'
import ChatSidebar from './ChatSidebar'
import SettingsModal from './SettingsModal'
import RepoBrowser from './RepoBrowser'
import FileTreePanel from './FileTreePanel'
import LoadLog from './LoadLog'
import LoadToast from './LoadToast'
import { loadRepoContext } from '../api/github'

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
  const [showBrowserModal, setShowBrowserModal] = useState(false)
  const [showTreePanel, setShowTreePanel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [repoError, setRepoError] = useState('')

  const addLog = useCallback<LogCallback>((entry) => {
    setLogs((prev) => [
      { ...entry, id: crypto.randomUUID(), timestamp: new Date() },
      ...prev,
    ])
  }, [])

  const handleLoadRepo = useCallback(async () => {
    if (!state.settings.repoOwner || !state.settings.repoName) {
      setShowSettings(true)
      return
    }
    setIsLoadingRepo(true)
    setRepoError('')
    try {
      const files = await loadRepoContext(
        state.settings.repoOwner,
        state.settings.repoName,
        state.settings.githubToken,
        50,
        addLog,
      )
      onSetRepoContext(files, true)
    } catch (err) {
      setRepoError((err as Error).message)
    } finally {
      setIsLoadingRepo(false)
    }
  }, [state.settings, onSetRepoContext, addLog])

  const role = state.role!
  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const bg = role === 'business' ? '#060D1F' : '#090612'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const lightColor = role === 'business' ? '#93C5FD' : '#D8B4FE'
  const roleLabel = role === 'business' ? 'Business Analyst' : 'Developer'
  const repoName =
    state.settings.repoOwner && state.settings.repoName
      ? `${state.settings.repoOwner}/${state.settings.repoName}`
      : null

  const headerBtnStyle: React.CSSProperties = {
    padding: '6px 12px',
    borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#94A3B8',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    whiteSpace: 'nowrap' as const,
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
          padding: '0 16px',
          height: 56,
          background: surface,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          gap: 10,
          overflow: 'hidden',
        }}
      >
        {/* Logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <img src="/dualmind-logo.svg" alt="DualMind AI" style={{ width: 32, height: 25, objectFit: 'contain' }} />
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #3B82F6, #A855F7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            DualMind AI
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Role badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 600,
            background: `${primary}22`,
            color: lightColor,
            border: `1px solid ${border}`,
            flexShrink: 0,
          }}
        >
          <span
            className="pulse-dot"
            style={{ width: 6, height: 6, borderRadius: '50%', background: primary, display: 'inline-block' }}
          />
          {roleLabel}
        </div>

        <div style={{ flex: 1 }} />

        {/* Repo pill with Change button */}
        {repoName ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 4px 4px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12,
              color: '#94A3B8',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13 }}>📂</span>
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repoName}
            </span>
            {state.repoLoaded && (
              <span style={{ color: '#10B981', fontSize: 11 }}>({state.repoFiles.length})</span>
            )}
            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.06)',
                color: '#94A3B8',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                transition: 'all 0.15s',
                marginLeft: 4,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            >
              Change
            </button>
          </div>
        ) : (
          <button
            style={{ ...headerBtnStyle, color: '#F59E0B', borderColor: 'rgba(245,158,11,0.25)' }}
            onClick={() => setShowSettings(true)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            + Set Repo
          </button>
        )}

        {/* Browse (tree panel toggle) — only when repo is configured */}
        {repoName && (
          <button
            style={{
              ...headerBtnStyle,
              color: showTreePanel ? primary : '#94A3B8',
              background: showTreePanel ? `${primary}18` : 'transparent',
              borderColor: showTreePanel ? border : 'rgba(255,255,255,0.1)',
            }}
            onClick={() => setShowTreePanel((v) => !v)}
            onMouseEnter={(e) => { if (!showTreePanel) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' } }}
            onMouseLeave={(e) => { if (!showTreePanel) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' } }}
          >
            🗂 Explorer
          </button>
        )}

        {/* Load Repo Context */}
        {repoName && (
          <button
            onClick={handleLoadRepo}
            disabled={isLoadingRepo}
            style={{
              ...headerBtnStyle,
              color: state.repoLoaded ? '#10B981' : '#94A3B8',
              borderColor: state.repoLoaded ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
              background: state.repoLoaded ? 'rgba(16,185,129,0.08)' : 'transparent',
              opacity: isLoadingRepo ? 0.6 : 1,
              cursor: isLoadingRepo ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!isLoadingRepo && !state.repoLoaded) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' } }}
            onMouseLeave={(e) => { if (!state.repoLoaded) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8' } }}
          >
            {isLoadingRepo ? '⟳ Loading…' : state.repoLoaded ? '✓ Repo Loaded' : '📁 Load Repo'}
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
                minWidth: 15,
                height: 15,
                borderRadius: 8,
                background: logs.some((l) => l.status === 'error') ? '#EF4444' : primary,
                color: 'white',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                lineHeight: 1,
              }}
            >
              {logs.length > 99 ? '99+' : logs.length}
            </span>
          )}
        </button>

        {/* No API key warning */}
        {!state.settings.apiKey && (
          <span style={{ fontSize: 11, color: '#F59E0B', flexShrink: 0 }}>⚠️ No API key</span>
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
          ↩ Role
        </button>
      </header>

      {/* Repo error banner */}
      {repoError && (
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(239,68,68,0.08)',
            borderBottom: '1px solid rgba(239,68,68,0.2)',
            fontSize: 12,
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>⚠ Failed to load repo: {repoError}</span>
          <button
            onClick={() => setRepoError('')}
            style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: 14 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel: File tree explorer OR Mode sidebar */}
        <div
          style={{
            width: showTreePanel && repoName ? 280 : 260,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'width 0.2s ease',
          }}
        >
          {showTreePanel && repoName && state.settings.repoOwner && state.settings.repoName ? (
            <FileTreePanel
              settings={state.settings}
              role={role}
              alreadyLoaded={state.repoFiles.map((f) => f.path)}
              onLoad={(files) => onSetRepoContext(files, true)}
              onLog={addLog}
            />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  color: '#475569',
                  marginBottom: 10,
                  paddingLeft: 4,
                }}
              >
                Quick Actions — select a mode
              </p>
              <ModeSidebar
                activeMode={state.activeMode}
                role={role}
                onSelectMode={onSetMode}
              />
            </div>
          )}
        </div>

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
          }}
        >
          <ModePanel
            key={state.activeMode}
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            repoLoaded={state.repoLoaded}
            specs={state.specs}
            onOpenSettings={() => setShowSettings(true)}
            onLog={addLog}
            repoError={repoError || undefined}
          />
        </div>

        {/* Chat sidebar */}
        {state.chatOpen && (
          <ChatSidebar
            activeMode={state.activeMode}
            role={role}
            settings={state.settings}
            repoFiles={state.repoFiles}
            specs={state.specs}
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

      {/* Keep RepoBrowser for full-screen browsing (accessible via double-click on repo name or modal trigger) */}
      {showBrowserModal && state.settings.repoOwner && state.settings.repoName && (
        <RepoBrowser
          settings={state.settings}
          role={role}
          alreadyLoaded={state.repoFiles.map((f) => f.path)}
          onLoad={(files) => onSetRepoContext(files, true)}
          onClose={() => setShowBrowserModal(false)}
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

      <LoadToast logs={logs} role={role} />
    </div>
  )
}
