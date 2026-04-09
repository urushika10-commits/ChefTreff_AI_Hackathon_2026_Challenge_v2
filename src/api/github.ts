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
 * Recursively fetches all source files from a repo (up to maxFiles).
 * Used by the "Load Repo Context" quick-load button.
 */
export async function loadRepoContext(
  owner: string,
  repo: string,
  githubToken: string,
  maxFiles = 50,
  onLog?: LogCallback,
): Promise<LoadedFile[]> {
  const loaded: LoadedFile[] = []

  async function traverse(path: string) {
    if (loaded.length >= maxFiles) return

    const items = await fetchRepoTree(owner, repo, githubToken, path)

    for (const item of items) {
      if (loaded.length >= maxFiles) break
      if (item.type === 'dir') {
        await traverse(item.path)
      } else if (item.type === 'file') {
        const filename = item.name
        const filePath = item.path
        const size = item.size ?? 0

        if (size >= 100_000) {
          onLog?.({
            source: 'repo-autoload',
            filename,
            path: filePath,
            status: 'skipped',
            sizeBytes: size,
            technicalDetail: `File size ${size.toLocaleString()} bytes exceeds 100 KB limit`,
            plainExplanation: `Skipped — this file is too large (${(size / 1024).toFixed(0)} KB). Only files under 100 KB are auto-loaded to keep the AI context focused.`,
          })
          continue
        }

        try {
          const content = await fetchFileContent(owner, repo, filePath, githubToken)
          loaded.push({ path: filePath, content })
          onLog?.({
            source: 'repo-autoload',
            filename,
            path: filePath,
            status: 'success',
            sizeBytes: content.length,
            plainExplanation: `Loaded successfully (${(content.length / 1024).toFixed(1)} KB, ${content.split('\n').length} lines).`,
          })
        } catch (e) {
          const msg = (e as Error)?.message ?? 'Unknown error'
          onLog?.({
            source: 'repo-autoload',
            filename,
            path: filePath,
            status: 'error',
            sizeBytes: size,
            technicalDetail: msg,
            plainExplanation: 'Could not read this file. It may be binary, corrupted, or access was denied.',
          })
        }
      }
    }
  }

  await traverse('')
  return loaded
}

export function formatRepoContext(files: LoadedFile[]): string {
  return files
    .map((f) => `### File: ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n')
}
