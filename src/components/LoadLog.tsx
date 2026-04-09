import { useState } from 'react'
import type { LogEntry, LogStatus, Role } from '../lib/types'

interface Props {
  logs: LogEntry[]
  role: Role
  onClear: () => void
  onClose: () => void
}

type Filter = 'all' | 'success' | 'skipped' | 'error' | 'warning'

const SOURCE_LABEL: Record<string, string> = {
  'repo-autoload': 'Auto-Load',
  'repo-browser':  'Browser',
  'file-upload':   'Upload',
  'zip-extract':   'ZIP',
}

const STATUS_ICON: Record<LogStatus, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  skipped: '⏭',
}

const STATUS_COLOR: Record<LogStatus, string> = {
  success: '#10B981',
  error:   '#EF4444',
  warning: '#F59E0B',
  skipped: '#64748B',
}

function fmt(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function LoadLog({ logs, role, onClear, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const primary    = role === 'business' ? '#3B82F6' : '#A855F7'
  const bg         = role === 'business' ? '#060D1F' : '#090612'
  const surface    = role === 'business' ? '#0D1B35' : '#120820'
  const card       = role === 'business' ? '#0F2040' : '#170A2E'
  const borderClr  = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'

  const counts = {
    all:     logs.length,
    success: logs.filter((l) => l.status === 'success').length,
    skipped: logs.filter((l) => l.status === 'skipped').length,
    warning: logs.filter((l) => l.status === 'warning').length,
    error:   logs.filter((l) => l.status === 'error').length,
  }

  const visible = filter === 'all'
    ? logs
    : logs.filter((l) => l.status === filter)

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const FILTERS: { key: Filter; label: string; color: string }[] = [
    { key: 'all',     label: `All (${counts.all})`,           color: '#94A3B8' },
    { key: 'success', label: `✅ Loaded (${counts.success})`, color: '#10B981' },
    { key: 'skipped', label: `⏭ Skipped (${counts.skipped})`, color: '#64748B' },
    { key: 'warning', label: `⚠️ Warnings (${counts.warning})`, color: '#F59E0B' },
    { key: 'error',   label: `❌ Errors (${counts.error})`,   color: '#EF4444' },
  ]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0,0,0,0.8)',
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
          width: '80vw',
          maxWidth: 900,
          height: '80vh',
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
          <span style={{ fontSize: 20 }}>📋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>Load Log</div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              Per-file results for every repo load, file upload, and ZIP extraction
            </div>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClear}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
                color: '#475569',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              🗑 Clear log
            </button>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: '0 4px', transition: 'color 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
          >×</button>
        </div>

        {/* ── Filter tabs ── */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 16px',
            borderBottom: `1px solid ${borderClr}`,
            background: card,
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {FILTERS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: filter === key ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.07)',
                background: filter === key ? `${color}20` : 'transparent',
                color: filter === key ? color : '#64748B',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 12,
                fontWeight: filter === key ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Log list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visible.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                color: '#475569',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 40, opacity: 0.4 }}>📋</span>
              <p style={{ fontSize: 14, color: '#64748B' }}>
                {logs.length === 0
                  ? 'No activity logged yet. Load a repo or upload files to see results here.'
                  : `No ${filter} entries to show.`}
              </p>
            </div>
          ) : (
            visible.map((entry) => {
              const isOpen = expanded.has(entry.id)
              const hasDetail = !!entry.technicalDetail
              return (
                <div
                  key={entry.id}
                  className="animate-fade-in"
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${STATUS_COLOR[entry.status]}22`,
                    background: `${STATUS_COLOR[entry.status]}08`,
                    overflow: 'hidden',
                  }}
                >
                  {/* Main row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '9px 12px',
                      cursor: hasDetail ? 'pointer' : 'default',
                    }}
                    onClick={() => hasDetail && toggleExpand(entry.id)}
                  >
                    {/* Status icon */}
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                      {STATUS_ICON[entry.status]}
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Filename */}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#F1F5F9',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={entry.path ?? entry.filename}
                      >
                        {entry.filename}
                      </div>
                      {/* Plain explanation */}
                      <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5, marginTop: 2 }}>
                        {entry.plainExplanation}
                      </div>
                    </div>

                    {/* Right meta */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      {/* Source badge */}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: `${primary}22`,
                          color: primary,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {SOURCE_LABEL[entry.source] ?? entry.source}
                      </span>
                      {/* Time + size */}
                      <div style={{ fontSize: 10, color: '#334155', textAlign: 'right' }}>
                        {fmt(entry.timestamp)}
                        {entry.sizeBytes ? ` · ${fmtSize(entry.sizeBytes)}` : ''}
                      </div>
                      {/* Expand indicator */}
                      {hasDetail && (
                        <span style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>
                          {isOpen ? '▲ hide detail' : '▼ tech detail'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Technical detail */}
                  {isOpen && entry.technicalDetail && (
                    <div
                      style={{
                        borderTop: `1px solid ${STATUS_COLOR[entry.status]}20`,
                        padding: '8px 12px 10px 36px',
                        background: 'rgba(0,0,0,0.2)',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        Technical detail
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 11.5,
                          color: '#64748B',
                          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          lineHeight: 1.55,
                        }}
                      >
                        {entry.path && entry.path !== entry.filename
                          ? `path: ${entry.path}\n${entry.technicalDetail}`
                          : entry.technicalDetail}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: `1px solid ${borderClr}`,
            background: surface,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 12,
            color: '#475569',
          }}
        >
          <span>
            <span style={{ color: '#10B981', fontWeight: 600 }}>{counts.success}</span> loaded ·{' '}
            <span style={{ color: '#64748B', fontWeight: 600 }}>{counts.skipped}</span> skipped ·{' '}
            <span style={{ color: '#F59E0B', fontWeight: 600 }}>{counts.warning}</span> warnings ·{' '}
            <span style={{ color: '#EF4444', fontWeight: 600 }}>{counts.error}</span> errors
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#334155' }}>Newest entries shown first · click a row to see technical detail</span>
        </div>
      </div>
    </div>
  )
}
