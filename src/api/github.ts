import type { RepoFile, LoadedFile } from '../lib/types'

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
 * Failed fetches are silently skipped.
 */
export async function loadSelectedFiles(
  owner: string,
  repo: string,
  paths: string[],
  githubToken: string,
): Promise<LoadedFile[]> {
  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const content = await fetchFileContent(owner, repo, path, githubToken)
      return { path, content }
    }),
  )
  return results
    .filter((r): r is PromiseFulfilledResult<LoadedFile> => r.status === 'fulfilled')
    .map((r) => r.value)
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
): Promise<LoadedFile[]> {
  const loaded: LoadedFile[] = []

  async function traverse(path: string, depth: number) {
    if (loaded.length >= maxFiles || depth > 5) return

    const items = await fetchRepoTree(owner, repo, githubToken, path)

    for (const item of items) {
      if (loaded.length >= maxFiles) break
      if (item.type === 'dir') {
        await traverse(item.path, depth + 1)
      } else if (item.type === 'file' && (item.size ?? 0) < 100_000) {
        try {
          const content = await fetchFileContent(owner, repo, item.path, githubToken)
          loaded.push({ path: item.path, content })
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await traverse('', 0)
  return loaded
}

export function formatRepoContext(files: LoadedFile[]): string {
  return files
    .map((f) => `### File: ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\``)
    .join('\n\n')
}
