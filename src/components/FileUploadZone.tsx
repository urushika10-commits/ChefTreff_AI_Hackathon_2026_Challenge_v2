import { useRef, useCallback, useState } from 'react'
import JSZip from 'jszip'
import type { UploadedFiles, UploadedImage, UploadedTextFile, LogCallback } from '../lib/types'

interface Props {
  files: UploadedFiles
  onChange: (files: UploadedFiles) => void
  role: 'business' | 'developer'
  compact?: boolean // smaller variant for chat sidebar
  onLog?: LogCallback
}

const CODE_EXTS = new Set([
  'js','ts','jsx','tsx','mjs','cjs',
  'py','rb','php','java','kt','swift','go','rs','c','cpp','cs','scala',
  'html','htm','css','scss','less','svelte','vue',
  'json','jsonc','yaml','yml','toml','xml','graphql','gql','proto',
  'md','txt','csv','sql','sh','bash','zsh','fish','ps1',
  'env','gitignore','dockerfile','makefile','ini','conf','config','lock',
])
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'])
const VIDEO_TYPES = new Set(['video/mp4','video/webm','video/ogg','video/quicktime','video/x-msvideo'])
const MAX_IMAGE_MB = 5
const MAX_TEXT_MB  = 2

function ext(name: string) { return name.split('.').pop()?.toLowerCase() ?? '' }
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsText(file)
  })
}

async function readAsBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result as string
      res(dataUrl.split(',')[1]) // strip "data:...;base64,"
    }
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

async function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function FileUploadZone({ files, onChange, role, compact = false, onLog }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [videoNote, setVideoNote] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface = role === 'business' ? '#0F2040' : '#170A2E'
  const border  = role === 'business' ? 'rgba(59,130,246,0.25)' : 'rgba(168,85,247,0.25)'

  const processFiles = useCallback(async (rawFiles: File[]) => {
    const newErrors: string[] = []
    const newTextFiles: UploadedTextFile[] = []
    const newImages: UploadedImage[] = []

    for (const file of rawFiles) {
      // ── ZIP ──────────────────────────────────────────────────────────────
      if (file.name.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(file)
          const entries = Object.entries(zip.files)
          let count = 0
          for (const [path, entry] of entries) {
            if (entry.dir) continue
            const name = path.split('/').pop() ?? path
            if (!CODE_EXTS.has(ext(name))) {
              onLog?.({
                source: 'zip-extract',
                filename: name,
                path,
                status: 'skipped',
                plainExplanation: `Skipped — "${name}" is not a recognised code or text file type. Only source files are extracted from ZIPs.`,
                technicalDetail: `Extension ".${ext(name)}" not in allowed list`,
              })
              continue
            }
            if (count >= 50) {
              onLog?.({
                source: 'zip-extract',
                filename: name,
                path,
                status: 'skipped',
                plainExplanation: 'Skipped — the 50-file limit per ZIP was reached. Remaining files were not extracted.',
                technicalDetail: 'count >= 50 safety cap',
              })
              break
            }
            const text = await entry.async('string')
            if (text.length > MAX_TEXT_MB * 1024 * 1024) {
              onLog?.({
                source: 'zip-extract',
                filename: name,
                path,
                status: 'skipped',
                sizeBytes: text.length,
                plainExplanation: `Skipped — "${name}" is too large (over ${MAX_TEXT_MB} MB). Very large files are excluded to avoid overloading the AI context.`,
                technicalDetail: `Content length ${text.length} bytes > ${MAX_TEXT_MB * 1024 * 1024} bytes`,
              })
              continue
            }
            newTextFiles.push({ name: path, content: text })
            onLog?.({
              source: 'zip-extract',
              filename: name,
              path,
              status: 'success',
              sizeBytes: text.length,
              plainExplanation: `Extracted successfully from ZIP (${(text.length / 1024).toFixed(1)} KB).`,
            })
            count++
          }
          if (count === 0) {
            newErrors.push(`${file.name}: no code files found inside`)
            onLog?.({
              source: 'zip-extract',
              filename: file.name,
              status: 'warning',
              sizeBytes: file.size,
              plainExplanation: `The ZIP "${file.name}" was opened but contained no recognised source code files.`,
              technicalDetail: 'Zero entries matched the allowed extension list',
            })
          }
        } catch (e) {
          newErrors.push(`${file.name}: failed to extract ZIP`)
          onLog?.({
            source: 'zip-extract',
            filename: file.name,
            status: 'error',
            sizeBytes: file.size,
            plainExplanation: `Could not open "${file.name}". The file may be corrupted, password-protected, or not a valid ZIP.`,
            technicalDetail: (e as Error)?.message ?? 'JSZip.loadAsync failed',
          })
        }
        continue
      }

      // ── Image ─────────────────────────────────────────────────────────────
      if (IMAGE_TYPES.has(file.type)) {
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
          newErrors.push(`${file.name}: image too large (max ${MAX_IMAGE_MB} MB)`)
          onLog?.({
            source: 'file-upload',
            filename: file.name,
            status: 'error',
            sizeBytes: file.size,
            plainExplanation: `Image "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum allowed size is ${MAX_IMAGE_MB} MB.`,
            technicalDetail: `file.size ${file.size} > ${MAX_IMAGE_MB * 1024 * 1024} bytes`,
          })
          continue
        }
        const base64 = await readAsBase64(file)
        const previewUrl = await readAsDataUrl(file)
        newImages.push({ name: file.name, mimeType: file.type, base64, previewUrl })
        onLog?.({
          source: 'file-upload',
          filename: file.name,
          status: 'success',
          sizeBytes: file.size,
          plainExplanation: `Image "${file.name}" uploaded and ready to send with your next message.`,
        })
        continue
      }

      // ── Video ─────────────────────────────────────────────────────────────
      if (VIDEO_TYPES.has(file.type)) {
        setVideoNote(true)
        onLog?.({
          source: 'file-upload',
          filename: file.name,
          status: 'skipped',
          sizeBytes: file.size,
          plainExplanation: `Video files are only supported when using a Google Gemini API key (starts with "AIza…"). "${file.name}" was not attached.`,
          technicalDetail: `MIME type ${file.type} requires Gemini vision endpoint`,
        })
        continue
      }

      // ── Text / code ───────────────────────────────────────────────────────
      if (CODE_EXTS.has(ext(file.name)) || file.type.startsWith('text/')) {
        if (file.size > MAX_TEXT_MB * 1024 * 1024) {
          newErrors.push(`${file.name}: file too large (max ${MAX_TEXT_MB} MB)`)
          onLog?.({
            source: 'file-upload',
            filename: file.name,
            status: 'error',
            sizeBytes: file.size,
            plainExplanation: `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Text files must be under ${MAX_TEXT_MB} MB.`,
            technicalDetail: `file.size ${file.size} > ${MAX_TEXT_MB * 1024 * 1024} bytes`,
          })
          continue
        }
        const text = await readAsText(file)
        newTextFiles.push({ name: file.name, content: text })
        onLog?.({
          source: 'file-upload',
          filename: file.name,
          status: 'success',
          sizeBytes: file.size,
          plainExplanation: `"${file.name}" uploaded (${(file.size / 1024).toFixed(1)} KB, ${text.split('\n').length} lines) and added to context.`,
        })
        continue
      }

      newErrors.push(`${file.name}: unsupported file type`)
      onLog?.({
        source: 'file-upload',
        filename: file.name,
        status: 'error',
        sizeBytes: file.size,
        plainExplanation: `"${file.name}" has a file type that isn't supported. Try uploading source code, images, or ZIP archives of a project.`,
        technicalDetail: `MIME type "${file.type}", extension ".${ext(file.name)}" not recognised`,
      })
    }

    setErrors(newErrors)
    onChange({
      textFiles: [...files.textFiles, ...newTextFiles],
      images:    [...files.images,    ...newImages],
    })
  }, [files, onChange, onLog])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  const handlePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }, [processFiles])

  const removeText  = (i: number) => onChange({ ...files, textFiles: files.textFiles.filter((_, j) => j !== i) })
  const removeImage = (i: number) => onChange({ ...files, images:    files.images.filter((_, j) => j !== i) })

  const total = files.textFiles.length + files.images.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${isDragging ? primary : border}`,
          borderRadius: 10,
          padding: compact ? '10px 14px' : '14px 18px',
          background: isDragging ? `${primary}0D` : surface,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: compact ? 18 : 22, opacity: 0.7 }}>📎</span>
        <div>
          <div style={{ fontSize: compact ? 11 : 12, fontWeight: 500, color: '#94A3B8' }}>
            {isDragging ? 'Drop files here' : 'Attach files'}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
            Code, ZIP, images · drag & drop or click
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.rb,.php,.cs,.cpp,.c,.html,.css,.json,.yaml,.yml,.md,.txt,.sql,.sh,.env,.csv,image/*,video/*"
          onChange={handlePick}
          style={{ display: 'none' }}
        />
      </div>

      {/* Video note */}
      {videoNote && (
        <div
          style={{
            fontSize: 11,
            padding: '7px 12px',
            borderRadius: 8,
            background: 'rgba(168,85,247,0.08)',
            border: '1px solid rgba(168,85,247,0.2)',
            color: '#D8B4FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span>🎬 Video support is Gemini-only — use an <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: 3 }}>AIza…</code> key to enable it</span>
          <button onClick={() => setVideoNote(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Errors */}
      {errors.map((e, i) => (
        <div key={i} style={{ fontSize: 11, color: '#EF4444', padding: '4px 0' }}>⚠ {e}</div>
      ))}

      {/* Uploaded files */}
      {total > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Images row */}
          {files.images.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {files.images.map((img, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    width: compact ? 52 : 64,
                    height: compact ? 52 : 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: `1px solid ${border}`,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    title={img.name}
                  />
                  <button
                    onClick={() => removeImage(i)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)',
                      border: 'none',
                      color: 'white',
                      fontSize: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Text files list */}
          {files.textFiles.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 8,
                background: `${primary}0D`,
                border: `1px solid ${border}`,
              }}
            >
              <span style={{ fontSize: 14 }}>
                {f.name.endsWith('.zip') ? '🗜' : ext(f.name) === 'md' ? '📝' : '📄'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 10, color: '#475569' }}>
                  {fmtSize(f.content.length)} · {f.content.split('\n').length} lines
                </div>
              </div>
              <button
                onClick={() => removeText(i)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#475569' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
