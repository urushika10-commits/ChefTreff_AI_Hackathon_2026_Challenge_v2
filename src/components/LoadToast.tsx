import { useState, useEffect, useRef } from 'react'
import type { LogEntry, LogStatus, Role } from '../lib/types'

interface Props {
  logs: LogEntry[]   // newest-first (same order as Layout state)
  role: Role
}

const WINDOW_SIZE = 4
const DISMISS_MS  = 4000   // hide 4 s after the last entry arrives

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

const STATUS_LABEL: Record<LogStatus, string> = {
  success: 'loaded',
  error:   'error',
  warning: 'warning',
  skipped: 'skipped',
}

export default function LoadToast({ logs, role }: Props) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track which "generation" of logs the current timer belongs to
  // so the progress bar resets properly on each new entry
  const [timerKey, setTimerKey] = useState(0)

  const primary   = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface   = role === 'business' ? '#0D1B35' : '#120820'
  const borderClr = role === 'business'
    ? 'rgba(59,130,246,0.28)'
    : 'rgba(168,85,247,0.28)'

  useEffect(() => {
    if (logs.length === 0) return
    setVisible(true)
    setTimerKey((k) => k + 1)   // re-trigger progress bar animation
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [logs.length])

  if (!visible || logs.length === 0) return null

  // logs is newest-first; reverse to get chronological order, then take last WINDOW_SIZE
  const chronological = [...logs].reverse()
  const windowEntries = chronological.slice(-WINDOW_SIZE)

  return (
    <div
      className="toast-enter"
      style={{
        position: 'fixed',
        top: 68,         // just below the 60px header
        right: 24,
        zIndex: 500,
        width: 310,
        background: surface,
        border: `1px solid ${borderClr}`,
        borderRadius: 12,
        boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${borderClr}`,
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
        pointerEvents: 'none',   // doesn't block clicks through it
      }}
    >
      {/* ── Title strip ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px 6px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: primary,
              animation: 'pulse-dot 1.2s infinite',
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: primary,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Loading files
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#334155' }}>
          {logs.length} total
        </span>
      </div>

      {/* ── File rows ── */}
      <div
        style={{
          padding: '6px 10px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {windowEntries.map((entry) => (
          <div
            key={entry.id}
            className="toast-row-enter"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '4px 7px',
              borderRadius: 7,
              background: `${STATUS_COLOR[entry.status]}0C`,
              border: `1px solid ${STATUS_COLOR[entry.status]}20`,
            }}
          >
            {/* Status icon */}
            <span style={{ fontSize: 12, flexShrink: 0 }}>
              {STATUS_ICON[entry.status]}
            </span>

            {/* Filename */}
            <span
              style={{
                fontSize: 12,
                color: '#CBD5E1',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 450,
              }}
              title={entry.path ?? entry.filename}
            >
              {entry.filename}
            </span>

            {/* Status label */}
            <span
              style={{
                fontSize: 10,
                color: STATUS_COLOR[entry.status],
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {STATUS_LABEL[entry.status]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Progress drain bar ── */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
        <div
          key={timerKey}  // re-mounts (restarts animation) on each new entry
          style={{
            height: '100%',
            background: primary,
            transformOrigin: 'left center',
            animation: `shrinkWidth ${DISMISS_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  )
}
