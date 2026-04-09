import { useState, useEffect, useCallback } from 'react'
import type { RepoFile, LoadedFile, Settings, Role, LogCallback } from '../lib/types'
import { fetchDirContents, fetchFileContent, loadSelectedFiles } from '../api/github'

interface Props {
  settings: Settings
  role: Role
  alreadyLoaded: string[]           // paths already in context (pre-checked)
  onLoad: (files: LoadedFile[]) => void
  onClose: () => void
  onLog?: LogCallback
}

const MAX_SELECT = 50

// Extensions that can be read as text and loaded as context
const TEXT_EXTS = new Set([
  'ts','tsx','js','jsx','mjs','cjs','svelte','vue',
  'py','rb','php','java','kt','swift','go','rs','c','cpp','cs','scala',
  'html','htm','css','scss','less','json','jsonc','yaml','yml','toml',
  'xml','graphql','gql','proto','md','txt','rst','csv','sql',
  'sh','bash','zsh','ps1','env','lock','conf','config','ini',
])
function isText(name: string) {
  const lower = name.toLowerCase()
  if (['dockerfile','makefile','.gitignore','.env','.editorconfig'].includes(lower)) return true
  return TEXT_EXTS.has(lower.split('.').pop() ?? '')
}

function fileIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile') return '🐳'
  if (lower === 'makefile' || lower.endsWith('.sh') || lower.endsWith('.bash')) return '⬛'
  if (lower === '.gitignore' || lower.startsWith('.env')) return '🔒'
  const ext = lower.split('.').pop() ?? ''
  const map: Record<string, string> = {
    ts:'📘', tsx:'⚛️', js:'📙', jsx:'⚛️', mjs:'📙',
    py:'🐍', java:'☕', go:'🐹', rs:'🦀', rb:'💎', php:'🐘', cs:'💜', swift:'🍎', kt:'🟠',
    json:'📋', yaml:'⚙️', yml:'⚙️', toml:'⚙️', xml:'📄', env:'🔒',
    md:'📝', txt:'📄', rst:'📄', csv:'📊', sql:'🗄️',
    html:'🌐', htm:'🌐', css:'🎨', scss:'🎨', less:'🎨',
    svg:'🖼️', png:'🖼️', jpg:'🖼️', gif:'🖼️', webp:'🖼️',
    pdf:'📑', zip:'🗜️', gz:'🗜️',
    graphql:'🔷', gql:'🔷', proto:'🔷',
  }
  return map[ext] ?? '📄'
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`
  return `${(bytes / 1024 / 1024).toFixed(1)}M`
}

export default function RepoBrowser({ settings, role, alreadyLoaded, onLoad, onClose, onLog }: Props) {
  const { repoOwner: owner, repoName: repo, githubToken: token } = settings

  // path → its children (lazy)
  const [cache, setCache] = useState<Record<string, RepoFile[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyLoaded))
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [error, setError] = useState('')

  const primary    = role === 'business' ? '#3B82F6' : '#A855F7'
  const bg         = role === 'business' ? '#060D1F' : '#090612'
  const surface    = role === 'business' ? '#0D1B35' : '#120820'
  const card       = role === 'business' ? '#0F2040' : '#170A2E'
  const borderClr  = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'

  // Fetch a directory (cached)
  const fetchDir = useCallback(async (path: string) => {
    if (cache[path] !== undefined) return
    setLoadingDirs((p) => new Set([...p, path]))
    try {
      const items = await fetchDirContents(owner, repo, token, path)
      setCache((p) => ({ ...p, [path]: items }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingDirs((p) => { const s = new Set(p); s.delete(path); return s })
    }
  }, [cache, owner, repo, token])

  // Load root on mount
  useEffect(() => { fetchDir('') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = useCallback(async (dir: RepoFile) => {
    await fetchDir(dir.path)
    setExpanded((p) => {
      const s = new Set(p)
      s.has(dir.path) ? s.delete(dir.path) : s.add(dir.path)
      return s
    })
  }, [fetchDir])

  const toggleSelect = useCallback((file: RepoFile) => {
    if (!isText(file.name)) return
    setSelected((p) => {
      const s = new Set(p)
      if (s.has(file.path)) {
        s.delete(file.path)
      } else {
        if (s.size >= MAX_SELECT) return p
        s.add(file.path)
      }
      return s
    })
  }, [])

  const openPreview = useCallback(async (file: RepoFile) => {
    if (!isText(file.name)) return
    setPreview({ path: file.path, content: '' })
    setPreviewLoading(true)
    try {
      const content = await fetchFileContent(owner, repo, file.path, token)
      setPreview({ path: file.path, content })
    } catch (e) {
      setPreview({ path: file.path, content: `⚠ ${(e as Error).message}` })
    } finally {
      setPreviewLoading(false)
    }
  }, [owner, repo, token])

  const handleLoad = useCallback(async () => {
    if (selected.size === 0 || loadingCtx) return
    setLoadingCtx(true)
    try {
      const files = await loadSelectedFiles(owner, repo, Array.from(selected), token, onLog)
      onLoad(files)
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setLoadingCtx(false)
    }
  }, [selected, loadingCtx, owner, repo, token, onLoad, onClose, onLog])

  // ── Tree renderer ──────────────────────────────────────────────────────────
  function TreeNode({ item, depth }: { item: RepoFile; depth: number }) {
    const isExpanded   = expanded.has(item.path)
    const isSelected   = selected.has(item.path)
    const isActive     = preview?.path === item.path
    const canSelect    = item.type === 'file' && isText(item.name)
    const canPreview   = item.type === 'file' && isText(item.name)
    const children     = cache[item.path]
    const isLoading    = loadingDirs.has(item.path)

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: `3px 8px 3px ${depth * 14 + 8}px`,
            borderRadius: 5,
            cursor: 'pointer',
            background: isActive ? `${primary}22` : 'transparent',
            transition: 'background 0.12s',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${primary}0F` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? `${primary}22` : 'transparent' }}
        >
          {/* Checkbox */}
          {canSelect ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(item)}
              onClick={(e) => e.stopPropagation()}
              style={{ accentColor: primary, cursor: 'pointer', flexShrink: 0, width: 13, height: 13 }}
            />
          ) : (
            <span style={{ width: 13, flexShrink: 0 }} />
          )}

          {/* Expand arrow for dirs */}
          {item.type === 'dir' ? (
            <span
              style={{
                fontSize: 9,
                color: '#475569',
                width: 10,
                flexShrink: 0,
                display: 'inline-block',
                transform: isExpanded ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            >▶</span>
          ) : (
            <span style={{ width: 10, flexShrink: 0 }} />
          )}

          {/* Icon */}
          <span style={{ fontSize: 13, flexShrink: 0 }}>
            {item.type === 'dir' ? (isExpanded ? '📂' : '📁') : fileIcon(item.name)}
          </span>

          {/* Name */}
          <span
            style={{
              fontSize: 13,
              color: item.type === 'dir'
                ? '#F1F5F9'
                : canPreview ? '#CBD5E1' : '#475569',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontWeight: isActive ? 500 : 400,
            }}
            onClick={() => {
              if (item.type === 'dir') toggleExpand(item)
              else openPreview(item)
            }}
          >
            {item.name}
          </span>

          {/* Size */}
          {item.type === 'file' && item.size !== undefined && (
            <span style={{ fontSize: 10, color: '#334155', flexShrink: 0, marginLeft: 4 }}>
              {fmtSize(item.size)}
            </span>
          )}

          {/* Spinner */}
          {isLoading && <span style={{ fontSize: 10, color: '#475569', animation: 'spin 1s linear infinite' }}>⟳</span>}
        </div>

        {/* Children */}
        {item.type === 'dir' && isExpanded && (
          <div>
            {children
              ? children.map((child) => <TreeNode key={child.path} item={child} depth={depth + 1} />)
              : isLoading
                ? <div style={{ paddingLeft: (depth + 1) * 14 + 24, fontSize: 11, color: '#475569', padding: '4px 8px 4px ' + ((depth + 1) * 14 + 24) + 'px' }}>Loading…</div>
                : null
            }
          </div>
        )}
      </div>
    )
  }

  const rootItems = cache['']

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          width: '92vw',
          maxWidth: 1200,
          height: '88vh',
          background: bg,
          border: `1px solid ${borderClr}`,
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: `0 30px 80px rgba(0,0,0,0.65), 0 0 0 1px ${borderClr}`,
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            borderBottom: `1px solid ${borderClr}`,
            background: surface,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 20 }}>📂</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
              {owner}/<span style={{ color: primary }}>{repo}</span>
            </div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              Read-only · browse, preview, select files for AI context
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {error && (
            <span style={{ fontSize: 12, color: '#EF4444', maxWidth: 300, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              ⚠ {error}
            </span>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: '0 4px', transition: 'color 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
          >×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* File tree pane */}
          <div
            style={{
              width: 300,
              flexShrink: 0,
              borderRight: `1px solid ${borderClr}`,
              overflowY: 'auto',
              background: card,
              padding: '6px 4px',
            }}
          >
            {loadingDirs.has('') && !rootItems ? (
              <div style={{ padding: 20, color: '#475569', fontSize: 13, textAlign: 'center' }}>
                Loading repository…
              </div>
            ) : rootItems ? (
              rootItems.map((item) => <TreeNode key={item.path} item={item} depth={0} />)
            ) : null}
          </div>

          {/* Preview pane */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {preview ? (
              <>
                {/* Preview header */}
                <div
                  style={{
                    padding: '10px 18px',
                    borderBottom: `1px solid ${borderClr}`,
                    background: surface,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{fileIcon(preview.path.split('/').pop() ?? '')}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {preview.path}
                  </span>
                  {!previewLoading && (
                    <button
                      onClick={() => {
                        const file = { path: preview.path, name: preview.path.split('/').pop() ?? preview.path, type: 'file' as const }
                        toggleSelect(file)
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: `1px solid ${borderClr}`,
                        background: selected.has(preview.path) ? `${primary}22` : 'transparent',
                        color: selected.has(preview.path) ? primary : '#94A3B8',
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.15s',
                      }}
                    >
                      {selected.has(preview.path) ? '☑ Selected' : '☐ Select for context'}
                    </button>
                  )}
                  {previewLoading && <span style={{ fontSize: 11, color: '#475569' }}>Loading…</span>}
                </div>

                {/* File content */}
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px 20px' }}>
                  {previewLoading ? (
                    <div style={{ color: '#475569', fontSize: 13 }}>Loading file…</div>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                        fontSize: 12.5,
                        color: '#CBD5E1',
                        lineHeight: 1.65,
                        whiteSpace: 'pre',
                        tabSize: 2,
                      }}
                    >
                      {preview.content}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  color: '#475569',
                  textAlign: 'center',
                  padding: 40,
                }}
              >
                <span style={{ fontSize: 48, opacity: 0.3 }}>👁</span>
                <p style={{ fontSize: 14, color: '#94A3B8' }}>Click any file to preview it here</p>
                <p style={{ fontSize: 12, maxWidth: 320, lineHeight: 1.6 }}>
                  Use the checkboxes in the tree to select which files to load as AI context.
                  You can select up to {MAX_SELECT} files at once.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderTop: `1px solid ${borderClr}`,
            background: surface,
            flexShrink: 0,
          }}
        >
          {/* Selection summary */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>
              <span style={{ color: primary, fontWeight: 700, fontSize: 15 }}>{selected.size}</span>
              <span style={{ color: '#475569' }}> / {MAX_SELECT} files selected for context</span>
            </span>
            {selected.size === MAX_SELECT && (
              <span style={{ fontSize: 11, color: '#F59E0B' }}>Maximum reached</span>
            )}
          </div>

          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
                color: '#475569',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              Clear selection
            </button>
          )}

          <button
            onClick={handleLoad}
            disabled={selected.size === 0 || loadingCtx}
            style={{
              padding: '9px 22px',
              borderRadius: 8,
              border: 'none',
              background: selected.size === 0 || loadingCtx ? 'rgba(255,255,255,0.06)' : primary,
              color: selected.size === 0 || loadingCtx ? '#475569' : 'white',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              cursor: selected.size === 0 || loadingCtx ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              minWidth: 160,
            }}
            onMouseEnter={(e) => { if (selected.size > 0 && !loadingCtx) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            {loadingCtx
              ? '⟳ Loading files…'
              : selected.size === 0
                ? 'Select files to load'
                : `Load ${selected.size} file${selected.size === 1 ? '' : 's'} as context`}
          </button>
        </div>
      </div>
    </div>
  )
}
