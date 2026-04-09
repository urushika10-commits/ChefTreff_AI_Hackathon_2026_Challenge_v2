import { useState, useRef, useCallback } from 'react'
import JSZip from 'jszip'
import type { Role, Settings, LoadedFile } from '../lib/types'

export interface SetupResult {
  settings: Partial<Settings>
  repoFiles: LoadedFile[]
  repoLoaded: boolean
  specs: string
}

interface Props {
  role: Role
  existingSettings: Settings
  onComplete: (result: SetupResult) => void
  onBack: () => void
}

type RepoMethod  = 'url' | 'zip'
type SpecsMethod = 'type' | 'file'

const CODE_EXTS = new Set([
  'js','ts','jsx','tsx','mjs','cjs','svelte','vue',
  'py','rb','php','java','kt','swift','go','rs','c','cpp','cs','scala',
  'html','htm','css','scss','less','json','jsonc','yaml','yml','toml',
  'xml','graphql','gql','proto','md','txt','rst','csv','sql',
  'sh','bash','zsh','ps1','env','lock','conf','config','ini',
  'gitignore','dockerfile','makefile','editorconfig',
])

function extOf(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }

function parseGitHubUrl(raw: string): { owner: string; repo: string } | null {
  try {
    const clean = raw.trim().replace(/\/$/, '')
    const u = new URL(clean)
    if (!u.hostname.includes('github.com')) return null
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

// ── Shared sub-components ─────────────────────────────────────────────────────

interface TabProps {
  active: boolean
  label: string
  badge?: string
  primary: string
  onClick: () => void
}
function MethodTab({ active, label, badge, primary, onClick }: TabProps) {
  const lightColor = primary === '#3B82F6' ? '#93C5FD' : '#D8B4FE'
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        borderRadius: 8,
        border: active ? `1px solid ${primary}` : '1px solid rgba(255,255,255,0.08)',
        background: active ? `${primary}20` : 'transparent',
        color: active ? lightColor : '#64748B',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {badge && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 8,
            background: '#10B981',
            color: 'white',
            letterSpacing: '0.03em',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

interface DropZoneProps {
  icon: string
  title: string
  subtitle: string
  accept: string
  filled: boolean
  filledIcon?: string
  filledName?: string
  filledSub?: string
  loading?: boolean
  error?: string
  onFile: (f: File) => void
  onClear: () => void
}
function DropZone({
  icon, title, subtitle, accept, filled,
  filledIcon = '✅', filledName, filledSub,
  loading, error, onFile, onClear,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        onClick={() => !filled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) onFile(f)
        }}
        style={{
          border: `1.5px dashed ${filled ? '#10B981' : dragging ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 10,
          padding: '22px 20px',
          textAlign: 'center',
          cursor: filled ? 'default' : 'pointer',
          background: filled ? 'rgba(16,185,129,0.05)' : dragging ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s',
        }}
      >
        {loading ? (
          <div style={{ color: '#475569', fontSize: 13 }}>⟳ Processing…</div>
        ) : filled ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18 }}>{filledIcon}</span>
            <div style={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>{filledName}</div>
            {filledSub && <div style={{ fontSize: 11, color: '#475569' }}>{filledSub}</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 26, opacity: 0.45 }}>{icon}</span>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>{title}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>{subtitle}</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: '#EF4444' }}>⚠ {error}</div>}
      {filled && (
        <button
          onClick={onClear}
          style={{
            background: 'none', border: 'none', color: '#475569',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 11, cursor: 'pointer', padding: 0, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
        >
          × Remove
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectSetup({ role, existingSettings, onComplete, onBack }: Props) {
  const primary    = role === 'business' ? '#3B82F6' : '#A855F7'
  const lightColor = role === 'business' ? '#93C5FD' : '#D8B4FE'
  const roleLabel  = role === 'business' ? 'Business Analyst' : 'Developer'
  const roleIcon   = role === 'business' ? '📊' : '⚙️'

  // ── Repo state ──────────────────────────────────────────────────────────────
  const [repoMethod, setRepoMethod]     = useState<RepoMethod>('url')
  const [repoUrl, setRepoUrl]           = useState(() => {
    const { repoOwner: o, repoName: r } = existingSettings
    return o && r ? `https://github.com/${o}/${r}` : ''
  })
  const [repoUrlError, setRepoUrlError] = useState('')
  const [githubToken, setGithubToken]   = useState(existingSettings.githubToken ?? '')
  const [showToken, setShowToken]       = useState(false)
  const [zipFiles, setZipFiles]         = useState<LoadedFile[]>([])
  const [zipName, setZipName]           = useState('')
  const [zipError, setZipError]         = useState('')
  const [zipLoading, setZipLoading]     = useState(false)

  // ── Specs state ─────────────────────────────────────────────────────────────
  const [specsMethod, setSpecsMethod]     = useState<SpecsMethod>('type')
  const [specsText, setSpecsText]         = useState('')
  const [specsFileName, setSpecsFileName] = useState('')
  const [specsError, setSpecsError]       = useState('')

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleZip = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) { setZipError('Please choose a .zip file.'); return }
    setZipError('')
    setZipLoading(true)
    try {
      const zip = await JSZip.loadAsync(file)
      const entries = Object.entries(zip.files)
      const loaded: LoadedFile[] = []
      for (const [path, entry] of entries) {
        if (entry.dir) continue
        const name = path.split('/').pop() ?? path
        const e = extOf(name)
        if (!CODE_EXTS.has(e) && !CODE_EXTS.has(name.toLowerCase())) continue
        if (loaded.length >= 50) break
        const text = await entry.async('string')
        if (text.length > 200_000) continue
        loaded.push({ path, content: text })
      }
      if (loaded.length === 0) {
        setZipError('No recognised source files found in this ZIP.')
      } else {
        setZipFiles(loaded)
        setZipName(file.name)
      }
    } catch {
      setZipError('Failed to open the ZIP. Make sure it is a valid archive.')
    }
    setZipLoading(false)
  }, [])

  const handleSpecsFile = useCallback(async (file: File) => {
    setSpecsError('')
    if (file.size > 2 * 1024 * 1024) { setSpecsError('File too large (max 2 MB).'); return }
    try {
      const text = await file.text()
      setSpecsText(text)
      setSpecsFileName(file.name)
    } catch {
      setSpecsError('Could not read the file.')
    }
  }, [])

  const handleContinue = () => {
    if (repoMethod === 'url') {
      if (!repoUrl.trim()) {
        setRepoUrlError('Please enter a GitHub repository URL, or use "Skip for now".')
        return
      }
      const parsed = parseGitHubUrl(repoUrl)
      if (!parsed) {
        setRepoUrlError('Not a valid GitHub URL — try https://github.com/owner/repo')
        return
      }
      setRepoUrlError('')
      onComplete({
        settings: { repoOwner: parsed.owner, repoName: parsed.repo, githubToken },
        repoFiles: [],
        repoLoaded: false,
        specs: specsText.trim(),
      })
    } else {
      onComplete({
        settings: { repoOwner: '', repoName: '', githubToken },
        repoFiles: zipFiles,
        repoLoaded: zipFiles.length > 0,
        specs: specsText.trim(),
      })
    }
  }

  const handleSkip = () =>
    onComplete({ settings: {}, repoFiles: [], repoLoaded: false, specs: specsText.trim() })

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputBase: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: '#F1F5F9',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const btnBase: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: 8,
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.12) 0%, transparent 60%), ' +
          'radial-gradient(ellipse at 70% 60%, rgba(168,85,247,0.12) 0%, transparent 60%), ' +
          'linear-gradient(135deg, #040812 0%, #080413 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '40px 16px',
        overflowY: 'auto',
      }}
    >
      {/* ── Step indicator ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 28,
          fontSize: 12,
          color: '#475569',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#10B981', fontWeight: 600 }}>✓ Role Selected</span>
        <span style={{ color: '#334155' }}>─────</span>
        <span style={{ color: primary, fontWeight: 700 }}>● Project Setup</span>
        <span style={{ color: '#334155' }}>─────</span>
        <span style={{ color: '#334155' }}>○ Main App</span>
      </div>

      {/* ── Card ── */}
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 680,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '36px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Card header */}
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
              background: `${primary}22`,
              color: lightColor,
              border: `1px solid ${primary}44`,
              marginBottom: 10,
            }}
          >
            {roleIcon} {roleLabel} Mode
          </span>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              color: '#F1F5F9',
              margin: 0,
            }}
          >
            Set up your project
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', marginTop: 6, lineHeight: 1.55, marginBottom: 0 }}>
            Connect your repository and optionally add specs so DualMind AI starts with full context from day one.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════
            SECTION 1 — Repository
        ══════════════════════════════════════════════════════════ */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
              GitHub Repository
            </span>
            <span style={{ fontSize: 10, color: '#475569' }}>· required for repo features</span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <MethodTab
              active={repoMethod === 'url'}
              label="🔗 GitHub URL"
              badge="Recommended"
              primary={primary}
              onClick={() => { setRepoMethod('url'); setRepoUrlError('') }}
            />
            <MethodTab
              active={repoMethod === 'zip'}
              label="📦 ZIP Archive"
              primary={primary}
              onClick={() => { setRepoMethod('zip'); setRepoUrlError('') }}
            />
          </div>

          {repoMethod === 'url' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setRepoUrlError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                placeholder="https://github.com/owner/repository"
                style={{
                  ...inputBase,
                  borderColor: repoUrlError ? '#EF4444' : 'rgba(255,255,255,0.1)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = repoUrlError ? '#EF4444' : primary }}
                onBlur={(e) => { e.currentTarget.style.borderColor = repoUrlError ? '#EF4444' : 'rgba(255,255,255,0.1)' }}
              />
              {repoUrlError && (
                <span style={{ fontSize: 12, color: '#EF4444' }}>⚠ {repoUrlError}</span>
              )}

              <button
                onClick={() => setShowToken((v) => !v)}
                style={{
                  background: 'none', border: 'none',
                  color: '#475569', fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 12, cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 5, width: 'fit-content',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
              >
                <span style={{ fontSize: 10 }}>{showToken ? '▼' : '▶'}</span>
                Private repository? Add a GitHub personal access token
              </button>

              {showToken && (
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  style={{
                    ...inputBase,
                    fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
                    fontSize: 13,
                    color: '#CBD5E1',
                  }}
                />
              )}
            </div>
          ) : (
            <DropZone
              icon="🗜️"
              title="Drop your ZIP archive here, or click to browse"
              subtitle="Source code files will be extracted automatically (up to 50 files)"
              accept=".zip"
              filled={zipFiles.length > 0}
              filledName={zipName}
              filledSub={`${zipFiles.length} source files extracted`}
              loading={zipLoading}
              error={zipError}
              onFile={handleZip}
              onClear={() => { setZipFiles([]); setZipName(''); setZipError('') }}
            />
          )}
        </section>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 2 — Specs / Requirements
        ══════════════════════════════════════════════════════════ */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
              Specs / Requirements
            </span>
            <span
              style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 10,
                background: 'rgba(245,158,11,0.12)',
                color: '#FCD34D',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              Optional
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#475569', margin: '-4px 0 0', lineHeight: 1.55 }}>
            Any business requirements, user stories, or technical specs the AI should treat as ground truth throughout this session.
          </p>

          <div style={{ display: 'flex', gap: 6 }}>
            <MethodTab
              active={specsMethod === 'type'}
              label="✏️ Type / paste here"
              primary={primary}
              onClick={() => setSpecsMethod('type')}
            />
            <MethodTab
              active={specsMethod === 'file'}
              label="📄 Upload a file"
              primary={primary}
              onClick={() => setSpecsMethod('file')}
            />
          </div>

          {specsMethod === 'type' ? (
            <textarea
              value={specsText}
              onChange={(e) => setSpecsText(e.target.value)}
              placeholder={
                'Paste your project requirements, user stories, acceptance criteria, or any context the AI should know about…\n\n' +
                'Example:\n"As a customer, I need to see a monthly payment estimate before applying for a loan.\nThe calculator must factor in credit score, term length, and interest rate."'
              }
              rows={6}
              style={{
                ...inputBase,
                fontSize: 13, lineHeight: 1.6,
                color: '#CBD5E1', resize: 'vertical', minHeight: 120,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = primary }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
            />
          ) : (
            <DropZone
              icon="📄"
              title="Drop a text file here, or click to browse"
              subtitle=".txt · .md · .rst · .csv · any plain-text format"
              accept=".txt,.md,.rst,.csv,.json,.yaml,.yml,.toml,.xml,.html,.adoc,.tex,.log"
              filled={specsFileName !== ''}
              filledName={specsFileName}
              filledSub={`${specsText.split('\n').length} lines · ${(specsText.length / 1024).toFixed(1)} KB`}
              error={specsError}
              onFile={handleSpecsFile}
              onClear={() => { setSpecsText(''); setSpecsFileName(''); setSpecsError('') }}
            />
          )}
        </section>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingTop: 6,
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <button
            onClick={onBack}
            style={{
              ...btnBase,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'transparent',
              color: '#64748B',
              fontWeight: 400,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
          >
            ← Change role
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={handleSkip}
            style={{
              ...btnBase,
              border: '1px solid rgba(255,255,255,0.07)',
              background: 'transparent',
              color: '#475569',
              fontWeight: 400,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
          >
            Skip for now
          </button>

          <button
            onClick={handleContinue}
            style={{
              ...btnBase,
              border: 'none',
              background: primary,
              color: 'white',
              fontWeight: 700,
              padding: '10px 26px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
