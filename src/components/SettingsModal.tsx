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
      // treat as "owner/repo" shorthand
      const parts = val.split('/')
      setForm((f) => ({
        ...f,
        repoOwner: parts[0]?.trim() ?? '',
        repoName: parts[1]?.trim() ?? '',
      }))
    }
  }

  const providerLabel = form.apiKey.startsWith('sk-ant-')
    ? '✅ Anthropic key detected'
    : form.apiKey.startsWith('sk-')
    ? '✅ OpenAI key detected'
    : ''

  function handleSave() {
    onSave(form)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">⚙️ Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Anthropic API Key <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-ant-... or sk-..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 px-2 py-1"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-slate-500">
                Accepts Anthropic <span className="text-slate-400">or</span> OpenAI keys. Stored in localStorage only.
              </p>
              {providerLabel && (
                <span className="text-xs text-emerald-400 shrink-0">{providerLabel}</span>
              )}
            </div>
          </div>

          {/* GitHub section */}
          <div className="border-t border-slate-800 pt-4">
            <p className="text-sm font-medium text-slate-300 mb-3">GitHub Repository Context</p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                GitHub URL or owner/repo
              </label>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => handleRepoChange(e.target.value)}
                placeholder="https://github.com/owner/repo  or  owner/repo"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {form.repoOwner && form.repoName && (
                <p className="text-xs text-emerald-400 mt-1">
                  ✓ {form.repoOwner}/{form.repoName}
                </p>
              )}
            </div>

            <div className="mt-3">
              <label className="block text-xs text-slate-400 mb-1">
                GitHub Token{' '}
                <span className="text-slate-600">(optional — increases rate limit)</span>
              </label>
              <input
                type="password"
                value={form.githubToken}
                onChange={(e) => setForm((f) => ({ ...f, githubToken: e.target.value }))}
                placeholder="ghp_..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Public repos work without a token (60 req/hr limit).
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.apiKey.trim()}
            className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}
