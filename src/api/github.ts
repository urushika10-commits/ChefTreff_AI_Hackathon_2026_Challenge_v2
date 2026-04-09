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
 * Recursively fetches all source files from a repo (up to maxFiles).
 * Returns files formatted as context strings for Claude.
 */
export async function loadRepoContext(
  owner: string,
  repo: string,
  githubToken: string,
  maxFiles = 20,
): Promise<LoadedFile[]> {
  const loaded: LoadedFile[] = []

  async function traverse(path: string, depth: number) {
    if (loaded.length >= maxFiles || depth > 3) return

    const items = await fetchRepoTree(owner, repo, githubToken, path)

    for (const item of items) {
      if (loaded.length >= maxFiles) break
      if (item.type === 'dir') {
        await traverse(item.path, depth + 1)
      } else if (item.type === 'file' && (item.size ?? 0) < 50_000) {
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
