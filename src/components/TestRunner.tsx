import { useState, useCallback, useEffect, useRef } from 'react'
import type { Role, Settings, LoadedFile, UploadedFiles, LogCallback } from '../lib/types'
import { streamChat } from '../api/claude'
import { formatRepoContext } from '../api/github'
import MarkdownRenderer from './MarkdownRenderer'

interface Props {
  role: Role
  settings: Settings
  repoFiles: LoadedFile[]
  uploadedFiles: UploadedFiles
  specs?: string
  onOpenSettings: () => void
  onLog?: LogCallback
}

type TestStatus = 'idle' | 'preparing' | 'running' | 'done' | 'error'

interface TestResult {
  id: string
  name: string
  status: 'pass' | 'fail' | 'warn' | 'skip'
  detail: string
}

const TEST_SYSTEM_PROMPT = (role: 'business' | 'developer') => `You are an expert code analysis and testing assistant.

Analyze the provided code files thoroughly and produce a structured test report.

IMPORTANT — respond ONLY in this exact format (no deviations):

## SUMMARY
[One paragraph overview of what the code does and overall quality]

## TEST_RESULTS
Each test result on its own line, format: STATUS | Test Name | Short detail
STATUS must be exactly one of: PASS, FAIL, WARN, SKIP
Example:
PASS | Input validation present | All required fields are validated before processing
FAIL | Null pointer handling | calculateTotal() does not check for null input
WARN | Error messages | Error messages expose internal stack traces
SKIP | Authentication check | No auth layer present in uploaded files

Produce 6-12 test result lines covering:
- Input validation
- Error handling
- Business logic correctness
- Edge cases
- Security considerations
- Code quality
- Performance considerations
- Test coverage (if tests are present)

## ANALYSIS
[Detailed technical analysis with specific findings, file references, and concrete recommendations]

${role === 'business'
  ? '\nExplain all findings in plain business language. No code snippets. Focus on risk and business impact.'
  : '\nInclude specific function names, line-level issues, and code snippets where helpful.'
}`

function parseTestResults(text: string): { summary: string; tests: TestResult[]; analysis: string } {
  const summaryMatch = text.match(/## SUMMARY\n([\s\S]*?)(?=## TEST_RESULTS|$)/)
  const testsMatch = text.match(/## TEST_RESULTS\n([\s\S]*?)(?=## ANALYSIS|$)/)
  const analysisMatch = text.match(/## ANALYSIS\n([\s\S]*)$/)

  const summary = summaryMatch?.[1]?.trim() ?? ''
  const analysis = analysisMatch?.[1]?.trim() ?? ''

  const tests: TestResult[] = []
  if (testsMatch?.[1]) {
    const lines = testsMatch[1].trim().split('\n')
    for (const line of lines) {
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length >= 3) {
        const rawStatus = parts[0].toUpperCase()
        const status: TestResult['status'] =
          rawStatus === 'PASS' ? 'pass' :
          rawStatus === 'FAIL' ? 'fail' :
          rawStatus === 'WARN' ? 'warn' : 'skip'
        tests.push({
          id: crypto.randomUUID(),
          name: parts[1],
          status,
          detail: parts.slice(2).join(' | '),
        })
      }
    }
  }

  return { summary, tests, analysis }
}

function StatusDot({ status }: { status: TestResult['status'] }) {
  const colors = {
    pass: '#10B981',
    fail: '#EF4444',
    warn: '#F59E0B',
    skip: '#475569',
  }
  const icons = { pass: '✓', fail: '✗', warn: '⚠', skip: '–' }
  return (
    <span
      style={{
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: `${colors[status]}22`,
        border: `1.5px solid ${colors[status]}`,
        color: colors[status],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {icons[status]}
    </span>
  )
}

export default function TestRunner({
  role,
  settings,
  repoFiles,
  uploadedFiles,
  specs,
  onOpenSettings,
}: Props) {
  const [status, setStatus] = useState<TestStatus>('idle')
  const [rawOutput, setRawOutput] = useState('')
  const [visibleTests, setVisibleTests] = useState<TestResult[]>([])
  const [parsed, setParsed] = useState<{ summary: string; tests: TestResult[]; analysis: string } | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [prepStep, setPrepStep] = useState(0)
  const abortRef = useRef(false)

  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const surface = role === 'business' ? '#0F2040' : '#170A2E'
  const borderClr = role === 'business' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'

  const hasFiles = uploadedFiles.textFiles.length > 0 || repoFiles.length > 0

  // Simulate prep steps animation
  useEffect(() => {
    if (status !== 'preparing') return
    const steps = ['Scanning files…', 'Building test plan…', 'Analysing code structure…']
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i < steps.length) {
        setPrepStep(i)
      } else {
        clearInterval(interval)
      }
    }, 600)
    return () => clearInterval(interval)
  }, [status])

  // As rawOutput streams in, parse and progressively reveal tests
  useEffect(() => {
    if (!rawOutput) return
    const p = parseTestResults(rawOutput)
    // Reveal tests one by one as they're parsed
    const newTests = p.tests
    setVisibleTests((prev) => {
      if (newTests.length > prev.length) return newTests.slice(0, prev.length + 1)
      return prev
    })
    setParsed(p)
  }, [rawOutput])

  // Stagger test reveal
  useEffect(() => {
    if (!parsed || status === 'running') return
    if (visibleTests.length < parsed.tests.length) {
      const timer = setTimeout(() => {
        setVisibleTests(parsed.tests.slice(0, visibleTests.length + 1))
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [visibleTests, parsed, status])

  const handleRun = useCallback(async () => {
    if (!settings.apiKey) { onOpenSettings(); return }
    if (!hasFiles) return

    abortRef.current = false
    setStatus('preparing')
    setPrepStep(0)
    setRawOutput('')
    setVisibleTests([])
    setParsed(null)
    setShowAnalysis(false)

    await new Promise((r) => setTimeout(r, 1500))
    setStatus('running')

    const repoContext = repoFiles.length > 0 ? formatRepoContext(repoFiles) : ''
    const contextNote = repoContext
      ? `\n\n---\n## Repository Context\n${repoContext}\n---`
      : ''
    const specsNote = specs?.trim()
      ? `\n\n---\n## Project Specifications\n${specs.trim()}\n---`
      : ''

    const systemPrompt = TEST_SYSTEM_PROMPT(role) + contextNote + specsNote

    let acc = ''
    await streamChat(
      [{ role: 'user', content: 'Analyze and test the provided code files. Produce the structured test report.' }],
      systemPrompt,
      settings.apiKey,
      {
        onText: (t) => {
          if (abortRef.current) return
          acc += t
          setRawOutput(acc)
        },
        onDone: () => {
          if (!abortRef.current) setStatus('done')
        },
        onError: (msg) => {
          setRawOutput(`Error: ${msg}`)
          setStatus('error')
        },
      },
      { textFiles: uploadedFiles.textFiles, images: [] },
    )
  }, [settings, hasFiles, repoFiles, uploadedFiles, role, specs, onOpenSettings])

  const PREP_STEPS = ['Scanning files…', 'Building test plan…', 'Analysing code structure…']

  if (!hasFiles) return null

  return (
    <div
      style={{
        border: `1px solid ${borderClr}`,
        borderRadius: 14,
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          background: surface,
          borderBottom: status !== 'idle' ? `1px solid ${borderClr}` : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🧪</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>Test & Analyse</div>
            <div style={{ fontSize: 11, color: '#475569' }}>
              {uploadedFiles.textFiles.length > 0
                ? `${uploadedFiles.textFiles.length} uploaded file${uploadedFiles.textFiles.length !== 1 ? 's' : ''}`
                : `${repoFiles.length} repo file${repoFiles.length !== 1 ? 's' : ''}`}
              {' '}ready for analysis
            </div>
          </div>
        </div>

        {status === 'idle' || status === 'done' || status === 'error' ? (
          <button
            onClick={handleRun}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: primary,
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Inter', system-ui, sans-serif",
              transition: 'opacity 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            {status === 'done' ? '↻ Re-run' : status === 'error' ? '↻ Retry' : '▶ Run Analysis'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: primary,
                display: 'inline-block',
                animation: 'pulse-dot 1s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              {status === 'preparing' ? PREP_STEPS[prepStep] : 'Analysing…'}
            </span>
          </div>
        )}
      </div>

      {/* Prep animation */}
      {status === 'preparing' && (
        <div style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.01)' }}>
          {PREP_STEPS.map((step, idx) => (
            <div
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '5px 0',
                opacity: idx <= prepStep ? 1 : 0.3,
                transition: 'opacity 0.4s ease',
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: idx < prepStep ? '#10B981' : idx === prepStep ? primary : 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  color: 'white',
                  flexShrink: 0,
                  transition: 'background 0.4s ease',
                }}
              >
                {idx < prepStep ? '✓' : idx === prepStep ? '…' : ''}
              </span>
              <span style={{ fontSize: 12, color: idx <= prepStep ? '#CBD5E1' : '#475569' }}>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Test results (streaming in) */}
      {(status === 'running' || status === 'done' || status === 'error') && (
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Summary */}
          {parsed?.summary && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 13,
                color: '#94A3B8',
                lineHeight: 1.6,
                marginBottom: 4,
              }}
            >
              {parsed.summary}
            </div>
          )}

          {/* Test results list */}
          {visibleTests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#475569', marginBottom: 2 }}>
                Test Results
              </div>
              {visibleTests.map((test, idx) => (
                <div
                  key={test.id}
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    background: test.status === 'fail'
                      ? 'rgba(239,68,68,0.06)'
                      : test.status === 'warn'
                      ? 'rgba(245,158,11,0.06)'
                      : test.status === 'pass'
                      ? 'rgba(16,185,129,0.06)'
                      : 'rgba(255,255,255,0.02)',
                    border: test.status === 'fail'
                      ? '1px solid rgba(239,68,68,0.2)'
                      : test.status === 'warn'
                      ? '1px solid rgba(245,158,11,0.2)'
                      : test.status === 'pass'
                      ? '1px solid rgba(16,185,129,0.2)'
                      : '1px solid rgba(255,255,255,0.05)',
                    animation: `fadeSlideIn 0.3s ease ${idx * 0.05}s both`,
                  }}
                >
                  <StatusDot status={test.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>{test.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 1.5 }}>{test.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Score bar */}
          {status === 'done' && parsed && parsed.tests.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Health Score
                </span>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  {(['pass', 'warn', 'fail', 'skip'] as const).map((s) => {
                    const count = parsed.tests.filter((t) => t.status === s).length
                    if (count === 0) return null
                    const colors = { pass: '#10B981', fail: '#EF4444', warn: '#F59E0B', skip: '#475569' }
                    const labels = { pass: 'Passed', fail: 'Failed', warn: 'Warnings', skip: 'Skipped' }
                    return (
                      <span key={s} style={{ color: colors[s] }}>
                        {count} {labels[s]}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
                {(['pass', 'warn', 'fail', 'skip'] as const).map((s) => {
                  const count = parsed.tests.filter((t) => t.status === s).length
                  const pct = (count / parsed.tests.length) * 100
                  const colors = { pass: '#10B981', fail: '#EF4444', warn: '#F59E0B', skip: '#475569' }
                  return pct > 0 ? (
                    <div key={s} style={{ width: `${pct}%`, background: colors[s], transition: 'width 0.6s ease' }} />
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Detailed analysis toggle */}
          {status === 'done' && parsed?.analysis && (
            <div style={{ marginTop: 4 }}>
              <button
                onClick={() => setShowAnalysis((v) => !v)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: `1px solid ${borderClr}`,
                  background: 'rgba(255,255,255,0.02)',
                  color: '#94A3B8',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#F1F5F9' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#94A3B8' }}
              >
                <span>📋 Detailed Analysis</span>
                <span style={{ fontSize: 10 }}>{showAnalysis ? '▲' : '▼'}</span>
              </button>
              {showAnalysis && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 13,
                    color: '#CBD5E1',
                    lineHeight: 1.7,
                    maxHeight: 400,
                    overflowY: 'auto',
                  }}
                >
                  <MarkdownRenderer>{parsed.analysis}</MarkdownRenderer>
                </div>
              )}
            </div>
          )}

          {/* Streaming indicator */}
          {status === 'running' && (
            <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: primary,
                    display: 'inline-block',
                    animation: `bounce 1.2s infinite ${delay}ms`,
                  }}
                />
              ))}
              <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>Analysing…</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
