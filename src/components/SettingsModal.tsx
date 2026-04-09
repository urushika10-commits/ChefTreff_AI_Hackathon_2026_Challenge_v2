import { useState } from 'react'
import type { Settings } from '../lib/types'

interface Props {
  settings: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}

/** Extract owner + repo from a full GitHub URL or return as-is */
function parseGitHubInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim()
  // https://github.com/owner/repo[/anything]
  const match = trimmed.match(/github\.com\/([^/]+)\/([^/?\s#]+)/)
  if (match) return { owner: match[1], repo: match[2] }
  return null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0F2040',
  border: '1px solid rgba(59,130,246,0.2)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  color: '#F1F5F9',
  fontFamily: "'Inter', system-ui, sans-serif",
  outline: 'none',
  transition: 'border-color 0.2s ease',
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<Settings>(settings)
  const [showKey, setShowKey] = useState(false)
  const [repoInput, setRepoInput] = useState(
    settings.repoOwner && settings.repoName
      ? `${settings.repoOwner}/${settings.repoName}`
      : '',
  )

  function handleRepoChange(val: string) {
    setRepoInput(val)
    const parsed = parseGitHubInput(val)
    if (parsed) {
      setForm((f) => ({ ...f, repoOwner: parsed.owner, repoName: parsed.repo }))
    } else {
      const parts = val.split('/')
      setForm((f) => ({
        ...f,
        repoOwner: parts[0]?.trim() ?? '',
        repoName: parts[1]?.trim() ?? '',
      }))
    }
  }

  const providerLabel = form.apiKey.startsWith('sk-ant-')
    ? '✅ Anthropic (Claude)'
    : form.apiKey.startsWith('xai-')
    ? '✅ xAI (Grok)'
    : form.apiKey.startsWith('AIza')
    ? '✅ Google (Gemini)'
    : form.apiKey.startsWith('sk-')
    ? '✅ OpenAI (GPT-4o)'
    : ''

  function handleSave() {
    onSave(form)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#0D1B35',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: 440,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>⚙️ Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#475569',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* API Key */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 6 }}>
              API Key <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-ant-…  sk-…  xai-…  AIza…"
                style={{ ...inputStyle, paddingRight: 56 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3B82F6' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)' }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#475569',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '4px 6px',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <p style={{ fontSize: 11, color: '#475569' }}>
                Anthropic · OpenAI · xAI (Grok) · Google (Gemini). Stored locally only.
              </p>
              {providerLabel && (
                <span style={{ fontSize: 11, color: '#10B981', flexShrink: 0 }}>{providerLabel}</span>
              )}
            </div>
          </div>

          {/* GitHub section */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', marginBottom: 12 }}>GitHub Repository Context</p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 6 }}>
                GitHub URL or owner/repo
              </label>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => handleRepoChange(e.target.value)}
                placeholder="https://github.com/owner/repo  or  owner/repo"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3B82F6' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)' }}
              />
              {form.repoOwner && form.repoName && (
                <p style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
                  ✓ {form.repoOwner}/{form.repoName}
                </p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#475569', marginBottom: 6 }}>
                GitHub Token{' '}
                <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional — increases rate limit)</span>
              </label>
              <input
                type="password"
                value={form.githubToken}
                onChange={(e) => setForm((f) => ({ ...f, githubToken: e.target.value }))}
                placeholder="ghp_…"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#3B82F6' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)' }}
              />
              <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                Public repos work without a token (60 req/hr limit).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.04)',
              color: '#94A3B8',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#94A3B8' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.apiKey.trim()}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: form.apiKey.trim() ? '#3B82F6' : 'rgba(255,255,255,0.06)',
              color: form.apiKey.trim() ? 'white' : '#475569',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: form.apiKey.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { if (form.apiKey.trim()) e.currentTarget.style.background = '#2563EB' }}
            onMouseLeave={(e) => { if (form.apiKey.trim()) e.currentTarget.style.background = '#3B82F6' }}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
