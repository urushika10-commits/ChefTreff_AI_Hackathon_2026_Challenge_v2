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

  const accentColor = role === 'business' ? 'text-amber-400' : 'text-indigo-400'
  const accentBg = role === 'business' ? 'bg-amber-500' : 'bg-indigo-600'
  const accentHover = role === 'business' ? 'hover:bg-amber-400' : 'hover:bg-indigo-500'

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
    <div className="h-full flex flex-col bg-slate-950">
      {/* Mode header */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-slate-800 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{mode.icon}</span>
            <h1 className="text-lg font-bold text-white">{mode.label}</h1>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{mode.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Repo context button */}
          <button
            onClick={handleLoadRepo}
            disabled={isLoadingRepo}
            title={
              repoLoaded
                ? `Repo loaded: ${settings.repoOwner}/${settings.repoName}`
                : 'Load repository files as context'
            }
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${repoLoaded
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {isLoadingRepo ? (
              <>
                <span className="animate-spin">⟳</span> Loading repo…
              </>
            ) : repoLoaded ? (
              <>✓ Repo loaded</>
            ) : (
              <>📁 Load Repo Context</>
            )}
          </button>
        </div>
      </div>

      {repoError && (
        <div className="mx-5 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          {repoError} —{' '}
          <button onClick={onOpenSettings} className="underline">
            check Settings
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Input area */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            {mode.inputLabel}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode.inputPlaceholder}
            rows={7}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-slate-600">
              Tip: Press <kbd className="bg-slate-800 px-1 rounded">⌘/Ctrl+Enter</kbd> to generate
            </p>
            <button
              onClick={handleGenerate}
              disabled={isStreaming || !input.trim()}
              className={`
                flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white
                ${accentBg} ${accentHover}
                disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
                transition-all active:scale-95
              `}
            >
              {isStreaming ? (
                <>
                  <span className="animate-spin">⟳</span> Generating…
                </>
              ) : (
                <>✨ Generate</>
              )}
            </button>
          </div>
        </div>

        {/* Thinking block */}
        {thinking && (
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowThinking((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-800/40 transition-colors"
            >
              <span className="text-purple-400 text-xs">🧠</span>
              <span className="text-xs font-medium text-purple-400">
                Claude's reasoning {showThinking ? '▲' : '▼'}
              </span>
            </button>
            {showThinking && (
              <div className="px-4 pb-3 text-xs text-slate-500 font-mono leading-relaxed max-h-48 overflow-y-auto border-t border-slate-800">
                {thinking}
              </div>
            )}
          </div>
        )}

        {/* Output area */}
        {(output || isStreaming) && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {mode.outputLabel}
              </label>
              {usage && (
                <span className="text-[11px] text-slate-600">
                  {usage.input.toLocaleString()} in · {usage.output.toLocaleString()} out tokens
                </span>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className={`prose-custom ${isStreaming && !output ? 'animate-pulse' : ''}`}>
                {output ? (
                  <div className={isStreaming ? 'streaming-cursor' : ''}>
                    <ReactMarkdown>{output}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Generating…</p>
                )}
              </div>
            </div>

            {output && !isStreaming && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => { setOutput(''); setThinking(''); setUsage(null) }}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md hover:bg-slate-800 transition-colors"
                >
                  🗑 Clear
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!output && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3">{mode.icon}</div>
            <p className="text-slate-500 text-sm max-w-xs">
              {mode.description}
            </p>
            {!repoLoaded && settings.repoOwner && (
              <p className="text-xs text-slate-600 mt-3">
                💡 Load your repo context above for more accurate results
              </p>
            )}
            {!settings.apiKey && (
              <button
                onClick={onOpenSettings}
                className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 underline"
              >
                Set your API key in Settings to get started
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
