import { useState } from 'react'
import type { ModeId, Role, Settings, LoadedFile, UploadedFiles, LogCallback } from '../lib/types'
import { MODES } from '../lib/systemPrompts'
import FileUploadZone from './FileUploadZone'
import TestRunner from './TestRunner'

interface Props {
  activeMode: ModeId
  role: Role
  settings: Settings
  repoFiles: LoadedFile[]
  repoLoaded: boolean
  specs?: string
  onOpenSettings: () => void
  onLog?: LogCallback
  repoError?: string
}

export default function ModePanel({
  activeMode,
  role,
  settings,
  repoFiles,
  repoLoaded,
  specs,
  onOpenSettings,
  onLog,
  repoError,
}: Props) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({ textFiles: [], images: [] })

  const mode = MODES.find((m) => m.id === activeMode)!

  const surface = role === 'business' ? '#0D1B35' : '#120820'
  const border = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'
  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const lightColor = role === 'business' ? '#93C5FD' : '#D8B4FE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode header */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 12,
          background: surface,
          border: `1px solid ${border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 24 }}>{mode.icon}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{mode.label}</span>
          {repoLoaded && (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: '#10B981',
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 100,
                padding: '2px 10px',
                fontWeight: 500,
              }}
            >
              ✓ {repoFiles.length} files loaded
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>{mode.description}</p>
      </div>

      {/* Repo error */}
      {repoError && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            fontSize: 12,
            color: '#EF4444',
          }}
        >
          {repoError} —{' '}
          <button
            onClick={onOpenSettings}
            style={{ textDecoration: 'underline', color: 'inherit', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
          >
            check Settings
          </button>
        </div>
      )}

      {/* File upload zone */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 8 }}>
          Upload Files for Analysis
        </div>
        <FileUploadZone
          files={uploadedFiles}
          onChange={setUploadedFiles}
          role={role}
          onLog={onLog}
        />
      </div>

      {/* Test runner — shows when files are available */}
      {(uploadedFiles.textFiles.length > 0 || repoFiles.length > 0) && (
        <TestRunner
          role={role}
          settings={settings}
          repoFiles={repoFiles}
          uploadedFiles={uploadedFiles}
          specs={specs}
          onOpenSettings={onOpenSettings}
          onLog={onLog}
        />
      )}

      {/* Empty state when no files */}
      {uploadedFiles.textFiles.length === 0 && repoFiles.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 40, opacity: 0.5 }}>{mode.icon}</div>
          <p style={{ color: '#475569', fontSize: 13, maxWidth: 300, lineHeight: 1.6 }}>
            Upload files above or load repo context from the header to start analysing with the AI assistant on the right.
          </p>
          {!settings.apiKey && (
            <button
              onClick={onOpenSettings}
              style={{
                marginTop: 4,
                fontSize: 12,
                color: lightColor,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              Set your API key in Settings to get started
            </button>
          )}
        </div>
      )}
    </div>
  )
}
