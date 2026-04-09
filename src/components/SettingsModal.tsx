import { useState } from 'react'
import type { Settings } from '../lib/types'

interface Props {
  settings: Settings
  onSave: (s: Settings) => void
  onClose: () => void
}

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [form, setForm] = useState<Settings>(settings)
  const [showKey, setShowKey] = useState(false)

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
                placeholder="sk-ant-..."
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
            <p className="text-xs text-slate-500 mt-1">
              Stored in your browser's localStorage only. Never sent anywhere except Anthropic.
            </p>
          </div>

          {/* GitHub section */}
          <div className="border-t border-slate-800 pt-4">
            <p className="text-sm font-medium text-slate-300 mb-3">GitHub Repository Context</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Owner / Org</label>
                <input
                  type="text"
                  value={form.repoOwner}
                  onChange={(e) => setForm((f) => ({ ...f, repoOwner: e.target.value }))}
                  placeholder="e.g. octocat"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Repository</label>
                <input
                  type="text"
                  value={form.repoName}
                  onChange={(e) => setForm((f) => ({ ...f, repoName: e.target.value }))}
                  placeholder="e.g. loan-calculator"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
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
