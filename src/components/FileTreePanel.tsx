import { useState, useEffect, useCallback } from 'react'
import type { RepoFile, LoadedFile, Settings, Role, LogCallback } from '../lib/types'
import { fetchDirContents, fetchFileContent, loadSelectedFiles } from '../api/github'

interface Props {
  settings: Settings
  role: Role
  alreadyLoaded: string[]
  onLoad: (files: LoadedFile[]) => void
  onLog?: LogCallback
}

const MAX_SELECT = 50

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

export default function FileTreePanel({ settings, role, alreadyLoaded, onLoad, onLog }: Props) {
  const { repoOwner: owner, repoName: repo, githubToken: token } = settings

  const [cache, setCache] = useState<Record<string, RepoFile[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loadingDirs, setLoadingDirs] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyLoaded))
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [error, setError] = useState('')

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const bg = role === 'business' ? '#060D1F' : '#090612'
  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const borderClr = role === 'business' ? 'rgba(59,130,246,0.15)' : 'rgba(168,85,247,0.15)'

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

  useEffect(() => { fetchDir('') }, []) // eslint-disable-line

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
      if (s.has(file.path)) { s.delete(file.path) }
      else { if (s.size >= MAX_SELECT) return p; s.add(file.path) }
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
    } catch (e) {
      setError((e as Error).message)
      setLoadingCtx(false)
    }
  }, [selected, loadingCtx, owner, repo, token, onLoad, onLog])

  function TreeNode({ item, depth }: { item: RepoFile; depth: number }) {
    const isExpanded = expanded.has(item.path)
    const isSelected = selected.has(item.path)
    const isActive = preview?.path === item.path
    const canSelect = item.type === 'file' && isText(item.name)
    const children = cache[item.path]
    const isLoading = loadingDirs.has(item.path)

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: `2px 6px 2px ${depth * 12 + 6}px`,
            borderRadius: 4,
            cursor: 'pointer',
            background: isActive ? `${primary}20` : 'transparent',
            transition: 'background 0.1s',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${primary}0D` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isActive ? `${primary}20` : 'transparent' }}
        >
          {/* Checkbox for text files */}
          {canSelect ? (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(item)}
              onClick={(e) => e.stopPropagation()}
              style={{ accentColor: primary, cursor: 'pointer', flexShrink: 0, width: 11, height: 11, marginRight: 2 }}
            />
          ) : (
            <span style={{ width: 13, flexShrink: 0 }} />
          )}

          {/* Expand arrow */}
          {item.type === 'dir' ? (
            <span
              onClick={() => toggleExpand(item)}
              style={{
                fontSize: 8,
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
          <span style={{ fontSize: 12, flexShrink: 0 }}>
            {item.type === 'dir' ? (isExpanded ? '📂' : '📁') : fileIcon(item.name)}
          </span>

          {/* Name */}
          <span
            style={{
              fontSize: 12,
              color: item.type === 'dir' ? '#E2E8F0' : canSelect ? '#CBD5E1' : '#475569',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              fontWeight: isActive ? 500 : 400,
              paddingLeft: 3,
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
            <span style={{ fontSize: 9, color: '#334155', flexShrink: 0 }}>{fmtSize(item.size)}</span>
          )}

          {isLoading && <span style={{ fontSize: 9, color: '#475569' }}>⟳</span>}
        </div>

        {item.type === 'dir' && isExpanded && (
          <div>
            {children
              ? children.map((child) => <TreeNode key={child.path} item={child} depth={depth + 1} />)
              : isLoading
                ? <div style={{ paddingLeft: (depth + 1) * 12 + 24, fontSize: 11, color: '#475569', padding: '3px 6px 3px ' + ((depth + 1) * 12 + 24) + 'px' }}>Loading…</div>
                : null
            }
          </div>
        )}
      </div>
    )
  }

  const rootItems = cache['']

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: bg,
        fontFamily: "'Inter', system-ui, sans-serif",
        borderRight: `1px solid ${borderClr}`,
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '10px 12px',
          background: surface,
          borderBottom: `1px solid ${borderClr}`,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 4 }}>
          Explorer
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {owner}/<span style={{ color: primary }}>{repo}</span>
        </div>
        {error && (
          <div style={{ fontSize: 10, color: '#EF4444', marginTop: 4, wordBreak: 'break-word' }}>⚠ {error}</div>
        )}
      </div>

      {/* File tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px' }}>
        {loadingDirs.has('') && !rootItems ? (
          <div style={{ padding: '16px 12px', color: '#475569', fontSize: 12, textAlign: 'center' }}>
            Loading repository…
          </div>
        ) : rootItems ? (
          rootItems.map((item) => <TreeNode key={item.path} item={item} depth={0} />)
        ) : null}
      </div>

      {/* Preview pane (inline, shown when a file is selected) */}
      {preview && (
        <div
          style={{
            borderTop: `1px solid ${borderClr}`,
            display: 'flex',
            flexDirection: 'column',
            height: 220,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '7px 12px',
              background: surface,
              borderBottom: `1px solid ${borderClr}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11 }}>{fileIcon(preview.path.split('/').pop() ?? '')}</span>
            <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {preview.path.split('/').pop()}
            </span>
            <button
              onClick={() => {
                const fileItem = { path: preview.path, name: preview.path.split('/').pop() ?? preview.path, type: 'file' as const }
                toggleSelect(fileItem)
              }}
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                border: `1px solid ${borderClr}`,
                background: selected.has(preview.path) ? `${primary}22` : 'transparent',
                color: selected.has(preview.path) ? primary : '#94A3B8',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: "'Inter', system-ui, sans-serif",
                flexShrink: 0,
              }}
            >
              {selected.has(preview.path) ? '☑' : '☐'}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
            >×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '8px 12px' }}>
            {previewLoading ? (
              <div style={{ color: '#475569', fontSize: 11 }}>Loading…</div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  fontSize: 11,
                  color: '#CBD5E1',
                  lineHeight: 1.55,
                  whiteSpace: 'pre',
                  tabSize: 2,
                }}
              >
                {preview.content}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Footer: selection count + load button */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: `1px solid ${borderClr}`,
          background: surface,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#475569' }}>
            <span style={{ color: primary, fontWeight: 700 }}>{selected.size}</span>
            <span> / {MAX_SELECT} selected</span>
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              style={{ fontSize: 10, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={handleLoad}
          disabled={selected.size === 0 || loadingCtx}
          style={{
            width: '100%',
            padding: '8px 0',
            borderRadius: 7,
            border: 'none',
            background: selected.size === 0 || loadingCtx ? 'rgba(255,255,255,0.06)' : primary,
            color: selected.size === 0 || loadingCtx ? '#475569' : 'white',
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            cursor: selected.size === 0 || loadingCtx ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { if (selected.size > 0 && !loadingCtx) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          {loadingCtx
            ? '⟳ Loading…'
            : selected.size === 0
              ? 'Select files to load'
              : `Load ${selected.size} file${selected.size !== 1 ? 's' : ''} as context`}
        </button>
      </div>
    </div>
  )
}
