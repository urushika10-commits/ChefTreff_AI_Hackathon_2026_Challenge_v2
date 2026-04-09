import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ModeId, Role, Settings, LoadedFile, Message, UploadedFiles, LogCallback } from '../lib/types'
import MarkdownRenderer from './MarkdownRenderer'
import { buildSystemPrompt } from '../lib/systemPrompts'
import { streamChat } from '../api/claude'
import { formatRepoContext } from '../api/github'
import { MODES } from '../lib/systemPrompts'
import FileUploadZone from './FileUploadZone'

interface Props {
  activeMode: ModeId
  role: Role
  settings: Settings
  repoFiles: LoadedFile[]
  specs?: string
  onOpenSettings: () => void
  onLog?: LogCallback
}

// 8 suggestions per mode — shown 4 at a time, cycling when mode changes
const ALL_SUGGESTIONS: Record<string, string[]> = {
  'biz-qa': [
    'How does the loan interest calculation work?',
    'Is the system compliant with EU regulations?',
    'What edge cases does the system handle?',
    'What happens when a customer has bad credit?',
    'How are monthly payments calculated?',
    'What data does the system store about customers?',
    'Can I get a plain-English summary of what this project does?',
    'What are the key business rules in this system?',
  ],
  'code-explorer': [
    'What are the main components of this codebase?',
    'How is input validation handled?',
    'Explain the data flow for a loan calculation.',
    'What design patterns are used here?',
    'Are there any potential bugs or edge cases?',
    'How is error handling structured?',
    'What are the key functions and their responsibilities?',
    'How does the API integrate with the frontend?',
  ],
  'spec-translator': [
    'Help me translate this requirement into technical tasks.',
    'What technical questions should I clarify with the BA?',
    'What acceptance criteria should I write for this feature?',
    'How should I break down this spec into smaller tasks?',
    'What are the compliance implications of this requirement?',
    'Which parts of this spec are ambiguous?',
    'What would this requirement look like as a user story?',
    'What are the edge cases I need to handle for this spec?',
  ],
  'task-generator': [
    'Break down the loan term feature into dev tasks.',
    'What tests should I write for this feature?',
    'Generate tickets for adding a new payment method.',
    'How should I prioritize these tasks?',
    'What are the dependencies between these work items?',
    'Create acceptance criteria for the interest rate feature.',
    'Break down the user authentication flow into tasks.',
    'What story points would you assign to this feature?',
  ],
  'change-explainer': [
    'How do I explain this refactor to stakeholders?',
    'What business impact does this change have?',
    'Summarize this PR in non-technical language.',
    'What compliance risks does this change introduce?',
    'How should I communicate this breaking change?',
    'What customer-facing impact does this change have?',
    'Write release notes for this feature update.',
    'How does this change affect existing users?',
  ],
  'docs-helper': [
    'Explain the API endpoints available.',
    'How do I integrate the loan calculator API?',
    'What authentication does this API use?',
    'Explain the error codes and how to handle them.',
    'How do I paginate results from this API?',
    'What are the rate limits for this service?',
    'Give me an integration example in TypeScript.',
    'What are the request and response schemas?',
  ],
}

// Returns 4 suggestions for a given mode, cycling through them based on a rotation index
function getSuggestions(modeId: ModeId, rotationIdx: number): string[] {
  const all = ALL_SUGGESTIONS[modeId] || []
  if (all.length <= 4) return all
  const start = (rotationIdx * 4) % all.length
  const result: string[] = []
  for (let i = 0; i < 4; i++) {
    result.push(all[(start + i) % all.length])
  }
  return result
}

// Role-based greeting messages
function getGreeting(role: Role, modeLabel: string): string {
  if (role === 'business') {
    return `Hi! I'm your AI assistant for **${modeLabel}** mode. I'm here to help you understand this project in plain business terms — no technical jargon, I promise.\n\nI can help you:\n- Understand what the system does and how it works\n- Check compliance and regulatory requirements\n- Translate technical changes into business impact\n- Answer questions about features, data, and decisions\n\nFeel free to ask me anything about the project!`
  } else {
    return `Hey! I'm your AI assistant in **${modeLabel}** mode. Ready to help you dig deep into the codebase.\n\nI can help you:\n- Analyse code, functions, and architecture\n- Translate specs into implementation tasks\n- Generate test cases with edge cases\n- Debug logic and identify potential issues\n\nAsk me anything — the more specific, the better!`
  }
}

export default function ChatSidebar({
  activeMode,
  role,
  settings,
  repoFiles,
  specs,
  onOpenSettings,
  onLog,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({ textFiles: [], images: [] })
  // Track how many times we've rotated suggestions per mode
  const [rotationIdx, setRotationIdx] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevModeRef = useRef<ModeId>(activeMode)

  const mode = MODES.find((m) => m.id === activeMode)!

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const aiBubbleBg = role === 'business' ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)'

  // When mode changes, advance rotation index
  useEffect(() => {
    if (prevModeRef.current !== activeMode) {
      prevModeRef.current = activeMode
      setRotationIdx((prev) => prev + 1)
    }
  }, [activeMode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? input
    if (!text.trim() || isStreaming) return
    if (!settings.apiKey) {
      onOpenSettings()
      return
    }

    const userMessage: Message = { role: 'user', content: text.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsStreaming(true)

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const repoContext = repoFiles.length > 0 ? formatRepoContext(repoFiles) : ''
    const systemPrompt = buildSystemPrompt(activeMode, role, repoContext, specs)

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
            updated[updated.length - 1] = { role: 'assistant', content: `❌ Error: ${msg}` }
            return updated
          })
        },
      },
      {
        textFiles: uploadedFiles.textFiles,
        images:    uploadedFiles.images,
      },
    )
    setUploadedFiles((prev) => ({ ...prev, images: [] }))
    setIsStreaming(false)
  }, [input, isStreaming, messages, settings, activeMode, role, repoFiles, onOpenSettings])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const starters = useMemo(() => getSuggestions(activeMode, rotationIdx), [activeMode, rotationIdx])
  const greeting = useMemo(() => getGreeting(role, mode.label), [role, mode.label])

  return (
    <aside
      style={{
        width: 480,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: surface,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/dualmind-logo.svg" alt="AI" style={{ width: 28, height: 22, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>AI Assistant</div>
            <div style={{ fontSize: 11, color: '#475569' }}>{mode.label} mode</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: '#475569',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          scrollBehavior: 'smooth',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Greeting message bubble */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                  background: `${primary}33`,
                  overflow: 'hidden',
                }}
              >
                <img src="/dualmind-logo.svg" alt="AI" style={{ width: 24, height: 19, objectFit: 'contain' }} />
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '4px 12px 12px 12px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: aiBubbleBg,
                  border: `1px solid ${border}`,
                  color: '#F1F5F9',
                  maxWidth: '88%',
                }}
              >
                <MarkdownRenderer className="prose-custom prose-chat">{greeting}</MarkdownRenderer>
              </div>
            </div>

            {/* Suggestion chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 42 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#475569', marginBottom: 2 }}>
                Try asking…
              </div>
              {starters.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  style={{
                    textAlign: 'left',
                    fontSize: 12,
                    color: '#94A3B8',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    lineHeight: 1.5,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${primary}18`
                    e.currentTarget.style.borderColor = `${primary}40`
                    e.currentTarget.style.color = '#F1F5F9'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.color = '#94A3B8'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className="animate-fade-in"
              style={{
                display: 'flex',
                gap: 10,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                  marginTop: 2,
                  background: msg.role === 'user'
                    ? 'rgba(255,255,255,0.1)'
                    : `${primary}33`,
                  overflow: 'hidden',
                }}
              >
                {msg.role === 'user'
                  ? <span>👤</span>
                  : <img src="/dualmind-logo.svg" alt="AI" style={{ width: 22, height: 17, objectFit: 'contain' }} />
                }
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  background: msg.role === 'user' ? 'rgba(255,255,255,0.07)' : aiBubbleBg,
                  border: msg.role === 'user' ? 'none' : `1px solid ${border}`,
                  color: '#F1F5F9',
                }}
              >
                {msg.role === 'assistant' ? (
                  msg.content ? (
                    <div className={isStreaming && i === messages.length - 1 ? 'streaming-cursor' : ''}>
                      <MarkdownRenderer className="prose-custom prose-chat">
                        {msg.content}
                      </MarkdownRenderer>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                      {[0, 150, 300].map((delay) => (
                        <span
                          key={delay}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#475569',
                            display: 'inline-block',
                            animation: `bounce 1.2s infinite ${delay}ms`,
                          }}
                        />
                      ))}
                    </div>
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
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <FileUploadZone
          files={uploadedFiles}
          onChange={setUploadedFiles}
          role={role}
          compact
          onLog={onLog}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '8px 12px',
            transition: 'border-color 0.2s ease',
          }}
          onFocusCapture={(e) => { e.currentTarget.style.borderColor = border }}
          onBlurCapture={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about the project…"
            rows={1}
            disabled={isStreaming}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13,
              color: '#F1F5F9',
              resize: 'none',
              lineHeight: 1.5,
              maxHeight: 120,
              minHeight: 20,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isStreaming || !input.trim()}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: isStreaming || !input.trim() ? 'rgba(255,255,255,0.06)' : primary,
              color: isStreaming || !input.trim() ? '#475569' : 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              fontSize: 15,
              transition: 'all 0.2s ease',
            }}
          >
            {isStreaming ? '⟳' : '↑'}
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#475569', textAlign: 'center' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </aside>
  )
}
