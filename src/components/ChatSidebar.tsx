import { useState, useRef, useEffect, useCallback } from 'react'
import type { ModeId, Role, Settings, LoadedFile, Message, UploadedFiles } from '../lib/types'
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({ textFiles: [], images: [] })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mode = MODES.find((m) => m.id === activeMode)!

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const aiBubbleBg = role === 'business' ? 'rgba(59,130,246,0.08)' : 'rgba(168,85,247,0.08)'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    // Clear images after send; keep text files for the conversation
    setUploadedFiles((prev) => ({ ...prev, images: [] }))

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
    <aside
      style={{
        width: 380,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#475569',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 36, opacity: 0.6 }}>🤖</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8' }}>Ready to help</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 220, color: '#475569' }}>
              Ask anything about the project in {mode.label} mode
            </div>
            {starters.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 8 }}>
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
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
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#F1F5F9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#94A3B8' }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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
                }}
              >
                {msg.role === 'user' ? '👤' : '🤖'}
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
            onClick={handleSend}
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
        <p style={{ fontSize: 10, color: '#475569', textAlign: 'center', marginTop: 8 }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </aside>
  )
}
