import type { RepoFile, LoadedFile, LogCallback } from '../lib/types'

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rb',
  '.json', '.yaml', '.yml', '.md', '.sql', '.html', '.css',
])

function isSourceFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.'))
  return SOURCE_EXTENSIONS.has(ext.toLowerCase())
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  githubToken: string,
  path = '',
): Promise<RepoFile[]> {
  const params = new URLSearchParams({ owner, repo, path })
  if (githubToken) params.set('githubToken', githubToken)

  const res = await fetch(`/api/github/repo?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `GitHub API error ${res.status}`)
  }

  const items = await res.json()
  return (items as Array<{ name: string; path: string; type: string; size?: number }>)
    .filter((item) => item.type === 'dir' || isSourceFile(item.name))
    .map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type as 'file' | 'dir',
      size: item.size,
    }))
}

export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  githubToken: string,
): Promise<string> {
  const params = new URLSearchParams({ owner, repo, path })
  if (githubToken) params.set('githubToken', githubToken)

  const res = await fetch(`/api/github/file?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch ${path}`)
  const data = await res.json()
  return data.content as string
}

/**
 * Fetches ALL items at a path without source-file filtering — used by the
 * file browser so every file/folder is visible regardless of extension.
 * Folders first, then files, both alphabetically.
 */
export async function fetchDirContents(
  owner: string,
  repo: string,
  githubToken: string,
  path = '',
): Promise<RepoFile[]> {
  const params = new URLSearchParams({ owner, repo, path })
  if (githubToken) params.set('githubToken', githubToken)

  const res = await fetch(`/api/github/repo?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `GitHub API error ${res.status}`)
  }

  const items = await res.json()
  return (items as Array<{ name: string; path: string; type: string; size?: number }>)
    .map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type as 'file' | 'dir',
      size: item.size,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/**
 * Fetch a specific set of file paths chosen by the user in the browser.
 * Failed fetches are logged (if onLog provided) and silently skipped.
 */
export async function loadSelectedFiles(
  owner: string,
  repo: string,
  paths: string[],
  githubToken: string,
  onLog?: LogCallback,
): Promise<LoadedFile[]> {
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const content = await fetchFileContent(owner, repo, path, githubToken)
      return { path, content }
    }),
  )

  const loaded: LoadedFile[] = []
  results.forEach((r, i) => {
    const path = paths[i]
    const filename = path.split('/').pop() ?? path
    if (r.status === 'fulfilled') {
      loaded.push(r.value)
      onLog?.({
        source: 'repo-browser',
        filename,
        path,
        status: 'success',
        sizeBytes: r.value.content.length,
        plainExplanation: 'File fetched and added to AI context.',
      })
    } else {
      const msg = (r.reason as Error)?.message ?? 'Unknown error'
      onLog?.({
        source: 'repo-browser',
        filename,
        path,
        status: 'error',
        technicalDetail: msg,
        plainExplanation: 'Could not read this file. It may be binary, private, or the path no longer exists.',
      })
    }
  })
  return loaded
}

/**
 * Fetches all source files from a repo (up to maxFiles) using the Git Trees API.
 * Gets the entire file tree in 2 requests (no recursive directory traversal),
 * then fetches file contents in parallel for speed.
 */
export async function loadRepoContext(
  owner: string,
  repo: string,
  githubToken: string,
  maxFiles = 50,
  onLog?: LogCallback,
): Promise<LoadedFile[]> {
  // Phase 1: get full repo tree in one request via Git Trees API
  const params = new URLSearchParams({ owner, repo })
  if (githubToken) params.set('githubToken', githubToken)

  const treeRes = await fetch(`/api/github/tree?${params}`)
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}))
    throw new Error(err.error || `GitHub API error ${treeRes.status}`)
  }
  const { tree } = await treeRes.json() as {
    tree: Array<{ path: string; type: string; size?: number }>
    branch: string
    truncated: boolean
  }

  // Filter to source files only
  const fileMetas = tree
    .filter((item) => item.type === 'blob' && isSourceFile(item.path.split('/').pop() ?? ''))
    .map((item) => ({
      name: item.path.split('/').pop() ?? item.path,
      path: item.path,
      size: item.size ?? 0,
    }))

  // Phase 2: filter oversized files, cap list, then fetch contents in parallel
  const eligible = fileMetas.filter((f) => {
    if (f.size >= 100_000) {
      onLog?.({
        source: 'repo-autoload',
        filename: f.name,
        path: f.path,
        status: 'skipped',
        sizeBytes: f.size,
        technicalDetail: `File size ${f.size.toLocaleString()} bytes exceeds 100 KB limit`,
        plainExplanation: `Skipped — this file is too large (${(f.size / 1024).toFixed(0)} KB).`,
      })
      return false
    }
    return true
  }).slice(0, maxFiles)

  const results = await Promise.allSettled(
    eligible.map((f) =>
      fetchFileContent(owner, repo, f.path, githubToken).then((content) => ({ f, content })),
    ),
  )

  const loaded: LoadedFile[] = []
  results.forEach((r, i) => {
    const meta = eligible[i]
    if (r.status === 'fulfilled') {
      const { f, content } = r.value
      loaded.push({ path: f.path, content })
      onLog?.({
        source: 'repo-autoload',
        filename: f.name,
        path: f.path,
        status: 'success',
        sizeBytes: content.length,
        plainExplanation: `Loaded successfully (${(content.length / 1024).toFixed(1)} KB, ${content.split('\n').length} lines).`,
      })
    } else {
      const msg = (r.reason as Error)?.message ?? 'Unknown error'
      onLog?.({
        source: 'repo-autoload',
        filename: meta?.name ?? '',
        path: meta?.path ?? '',
        status: 'error',
        technicalDetail: msg,
        plainExplanation: 'Could not read this file. It may be binary, corrupted, or access was denied.',
      })
    }
  })
  return loaded
}

export function formatRepoContext(files: LoadedFile[]): string {
  return files
    .map((f) => `### File: ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n')
}
