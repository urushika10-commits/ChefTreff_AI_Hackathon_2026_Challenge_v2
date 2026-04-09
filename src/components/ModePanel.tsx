import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ModeId, Role, Settings, LoadedFile } from '../lib/types'
import { MODES, buildSystemPrompt } from '../lib/systemPrompts'
import { streamChat } from '../api/claude'
import { loadRepoContext, formatRepoContext } from '../api/github'

interface Props {
  activeMode: ModeId
  role: Role
  settings: Settings
  repoFiles: LoadedFile[]
  repoLoaded: boolean
  onSetRepoContext: (files: LoadedFile[], loaded: boolean) => void
  onOpenSettings: () => void
}

export default function ModePanel({
  activeMode,
  role,
  settings,
  repoFiles,
  repoLoaded,
  onSetRepoContext,
  onOpenSettings,
}: Props) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [thinking, setThinking] = useState('')
  const [showThinking, setShowThinking] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [repoError, setRepoError] = useState('')
  const [usage, setUsage] = useState<{ input: number; output: number } | null>(null)
  const abortRef = useRef(false)

  const mode = MODES.find((m) => m.id === activeMode)!

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const cardBg = role === 'business' ? '#0F2040' : '#170A2E'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const lightColor = role === 'business' ? '#93C5FD' : '#D8B4FE'

  const handleGenerate = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }

    setOutput('')
    setThinking('')
    setUsage(null)
    setIsStreaming(true)
    abortRef.current = false

    const repoContext = repoFiles.length > 0 ? formatRepoContext(repoFiles) : ''
    const systemPrompt = buildSystemPrompt(activeMode, role, repoContext)

    let textAcc = ''
    let thinkAcc = ''

    await streamChat(
      [{ role: 'user', content: input }],
      systemPrompt,
      settings.apiKey,
      {
        onText: (t) => {
          if (abortRef.current) return
          textAcc += t
          setOutput(textAcc)
        },
        onThinkingStart: () => setThinking(''),
        onThinking: (t) => {
          thinkAcc += t
          setThinking(thinkAcc)
        },
        onDone: (u) => setUsage(u),
        onError: (msg) => {
          setOutput(`❌ Error: ${msg}`)
        },
      },
    )

    setIsStreaming(false)
  }, [input, isStreaming, settings.apiKey, activeMode, role, repoFiles, onOpenSettings])

  const handleLoadRepo = useCallback(async () => {
    if (!settings.repoOwner || !settings.repoName) {
      setRepoError('Set repo owner and name in Settings first.')
      return
    }
    setIsLoadingRepo(true)
    setRepoError('')
    try {
      const files = await loadRepoContext(
        settings.repoOwner,
        settings.repoName,
        settings.githubToken,
      )
      onSetRepoContext(files, true)
    } catch (err) {
      setRepoError((err as Error).message)
    } finally {
      setIsLoadingRepo(false)
    }
  }, [settings, onSetRepoContext])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleGenerate()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode header */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: surface,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 24 }}>{mode.icon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{mode.label}</span>
          </div>
          <p style={{ fontSize: 13, color: '#94A3B8' }}>{mode.description}</p>
        </div>

        <button
          onClick={handleLoadRepo}
          disabled={isLoadingRepo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: repoLoaded ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
            background: repoLoaded ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
            color: repoLoaded ? '#10B981' : '#94A3B8',
            fontSize: 12,
            fontWeight: 500,
            cursor: isLoadingRepo ? 'not-allowed' : 'pointer',
            opacity: isLoadingRepo ? 0.6 : 1,
            flexShrink: 0,
            fontFamily: "'Inter', system-ui, sans-serif",
            transition: 'all 0.2s ease',
          }}
        >
          {isLoadingRepo ? '⟳ Loading…' : repoLoaded ? '✓ Repo loaded' : '📁 Load Repo Context'}
        </button>
      </div>

      {repoError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 12,
            color: '#EF4444',
          }}
        >
          {repoError} —{' '}
          <button onClick={onOpenSettings} style={{ textDecoration: 'underline', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
            check Settings
          </button>
        </div>
      )}

      {/* Input area */}
      <div>
        <label
          style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}
        >
          {mode.inputLabel}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mode.inputPlaceholder}
          rows={7}
          style={{
            width: '100%',
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 13,
            color: '#F1F5F9',
            fontFamily: "'Inter', system-ui, sans-serif",
            resize: 'vertical',
            outline: 'none',
            lineHeight: 1.6,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = primary }}
          onBlur={(e) => { e.currentTarget.style.borderColor = border }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <p style={{ fontSize: 11, color: '#475569' }}>
            Tip: Press <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>⌘/Ctrl+Enter</kbd> to generate
          </p>
          <button
            onClick={handleGenerate}
            disabled={isStreaming || !input.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: isStreaming || !input.trim() ? 'rgba(255,255,255,0.06)' : primary,
              color: isStreaming || !input.trim() ? '#475569' : 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'all 0.2s ease',
            }}
          >
            {isStreaming ? '⟳ Generating…' : '✨ Generate'}
          </button>
        </div>
      </div>

      {/* Thinking block */}
      {thinking && (
        <div
          style={{
            background: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setShowThinking((v) => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              textAlign: 'left',
            }}
          >
            <span style={{ color: '#A855F7', fontSize: 13 }}>🧠</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#A855F7' }}>
              Claude's reasoning {showThinking ? '▲' : '▼'}
            </span>
          </button>
          {showThinking && (
            <div
              style={{
                padding: '0 16px 12px',
                fontSize: 11,
                color: '#475569',
                fontFamily: 'monospace',
                lineHeight: 1.6,
                maxHeight: 192,
                overflowY: 'auto',
                borderTop: '1px solid rgba(168,85,247,0.1)',
              }}
            >
              {thinking}
            </div>
          )}
        </div>
      )}

      {/* Output area */}
      {(output || isStreaming) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569' }}>
              {mode.outputLabel}
            </label>
            {usage && (
              <span style={{ fontSize: 11, color: '#475569' }}>
                {usage.input.toLocaleString()} in · {usage.output.toLocaleString()} out tokens
              </span>
            )}
          </div>
          <div
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: 12,
              padding: '20px',
            }}
          >
            <div className={`prose-custom ${isStreaming && !output ? '' : ''}`}>
              {output ? (
                <div className={isStreaming ? 'streaming-cursor' : ''}>
                  <ReactMarkdown>{output}</ReactMarkdown>
                </div>
              ) : (
                <p style={{ color: '#475569', fontSize: 13 }}>Generating…</p>
              )}
            </div>
          </div>

          {output && !isStreaming && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[
                { label: '📋 Copy', action: () => navigator.clipboard.writeText(output) },
                { label: '🗑 Clear', action: () => { setOutput(''); setThinking(''); setUsage(null) } },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  style={{
                    fontSize: 11,
                    color: '#475569',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94A3B8' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#475569' }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!output && !isStreaming && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.6 }}>{mode.icon}</div>
          <p style={{ color: '#475569', fontSize: 13, maxWidth: 300, lineHeight: 1.6 }}>{mode.description}</p>
          {!repoLoaded && settings.repoOwner && (
            <p style={{ color: '#475569', fontSize: 12, marginTop: 10 }}>
              💡 Load your repo context above for more accurate results
            </p>
          )}
          {!settings.apiKey && (
            <button
              onClick={onOpenSettings}
              style={{
                marginTop: 16,
                fontSize: 12,
                color: lightColor,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Set your API key in Settings to get started
            </button>
          )}
        </div>
      )}
    </div>
  )
}
