import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ModeId, Role, Settings, LoadedFile, Message } from '../lib/types'
import { buildSystemPrompt } from '../lib/systemPrompts'
import { streamChat } from '../api/claude'
import { formatRepoContext } from '../api/github'
import { MODES } from '../lib/systemPrompts'

interface Props {
  activeMode: ModeId
  role: Role
  settings: Settings
  repoFiles: LoadedFile[]
  onOpenSettings: () => void
}

export default function ChatSidebar({
  activeMode,
  role,
  settings,
  repoFiles,
  onOpenSettings,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mode = MODES.find((m) => m.id === activeMode)!
  const accentBg = role === 'business' ? 'bg-amber-500' : 'bg-indigo-600'
  const accentHover = role === 'business' ? 'hover:bg-amber-400' : 'hover:bg-indigo-500'
  const userBubble =
    role === 'business'
      ? 'bg-amber-500/20 border-amber-500/30'
      : 'bg-indigo-500/20 border-indigo-500/30'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const repoContext = repoFiles.length > 0 ? formatRepoContext(repoFiles) : ''
    const systemPrompt = buildSystemPrompt(activeMode, role, repoContext)

    let textAcc = ''

    await streamChat(
      newMessages,
      systemPrompt,
      settings.apiKey,
      {
        onText: (t) => {
          textAcc += t
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: textAcc }
            return updated
          })
        },
        onError: (msg) => {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `❌ Error: ${msg}`,
            }
            return updated
          })
        },
      },
    )

    setIsStreaming(false)
  }, [input, isStreaming, messages, settings, activeMode, role, repoFiles, onOpenSettings])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const STARTER_PROMPTS: Record<string, string[]> = {
    'biz-qa': [
      'How does the loan interest calculation work?',
      'Is the system compliant with EU regulations?',
      'What edge cases does the system handle?',
    ],
    'code-explorer': [
      'What are the main components of this codebase?',
      'How is input validation handled?',
      'Explain the data flow for a loan calculation.',
    ],
    'spec-translator': [
      'Help me translate this requirement into technical tasks.',
      'What technical questions should I clarify with the BA?',
    ],
    'task-generator': [
      'Break down the loan term feature into dev tasks.',
      'What tests should I write for this feature?',
    ],
    'change-explainer': [
      'How do I explain this refactor to stakeholders?',
      'What business impact does this change have?',
    ],
    'docs-helper': [
      'Explain the API endpoints available.',
      'How do I integrate the loan calculator API?',
    ],
  }

  const starters = STARTER_PROMPTS[activeMode] || []

  return (
    <aside className="w-72 shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-800 flex items-center gap-2">
        <span className="text-base">{mode.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">Quick Chat</p>
          <p className="text-[11px] text-slate-500 truncate">{mode.label} mode</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-600 hover:text-slate-400 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
            title="Clear chat"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 text-center pt-4 pb-2">
              Ask a quick question in {mode.label} mode
            </p>
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s) }}
                className="w-full text-left text-xs text-slate-400 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-2 transition-colors leading-relaxed"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`animate-fade-in ${msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
            >
              <div
                className={`
                  max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed border
                  ${msg.role === 'user'
                    ? `${userBubble} text-slate-200 rounded-br-sm`
                    : 'bg-slate-800 border-slate-700 text-slate-300 rounded-bl-sm'
                  }
                  ${isStreaming && i === messages.length - 1 && msg.role === 'assistant' && !msg.content
                    ? 'animate-pulse'
                    : ''
                  }
                `}
              >
                {msg.role === 'assistant' ? (
                  msg.content ? (
                    <div
                      className={`prose-custom text-xs ${
                        isStreaming && i === messages.length - 1 ? 'streaming-cursor' : ''
                      }`}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-slate-500">Thinking…</span>
                  )
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 p-3 border-t border-slate-800">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none overflow-hidden leading-relaxed disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className={`
              shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
              ${accentBg} ${accentHover}
              disabled:bg-slate-700 disabled:text-slate-500
              text-white text-sm transition-all active:scale-95
            `}
          >
            {isStreaming ? '⟳' : '↑'}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-1.5 text-center">
          Shift+Enter for new line
        </p>
      </div>
    </aside>
  )
}
