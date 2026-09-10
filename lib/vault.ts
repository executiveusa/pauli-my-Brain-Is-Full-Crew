// Vault source abstraction — GitHub API or Tailscale local proxy
// Set VAULT_SOURCE=github (default) or VAULT_SOURCE=tailscale in env

export interface VaultFile {
  path: string
  name: string
  type: 'file' | 'dir'
  sha?: string
  size?: number
  url?: string
}

export interface VaultNote {
  path: string
  content: string
  frontmatter: Record<string, unknown>
  body: string
}

export class VaultPathError extends Error {
  constructor() {
    super('Invalid vault path')
    this.name = 'VaultPathError'
  }
}

export function normalizeVaultPath(
  value: string,
  options: { markdownOnly?: boolean } = {}
): string {
  const raw = String(value ?? '').trim()
  if (raw.length > 1024 || raw.includes('\0') || raw.includes('\\') || raw.startsWith('/')) {
    throw new VaultPathError()
  }
  if (!raw) return ''

  const segments = raw.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) {
    throw new VaultPathError()
  }

  const normalized = segments.join('/')
  if (options.markdownOnly && !normalized.toLowerCase().endsWith('.md')) {
    throw new VaultPathError()
  }
  return normalized
}

function encodedVaultPath(path: string): string {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

// ── GitHub source ──────────────────────────────────────────────────────────

async function githubFetch(endpoint: string) {
  const token = process.env.VAULT_GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers,
    next: { revalidate: 30 },
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  return res.json()
}

async function listGithubPath(path: string): Promise<VaultFile[]> {
  const owner = process.env.VAULT_GITHUB_OWNER?.trim()
  const repo = process.env.VAULT_GITHUB_REPO?.trim()
  const branch = process.env.VAULT_GITHUB_BRANCH?.trim() || 'main'
  if (!owner || !repo) throw new Error('GitHub vault source not configured')

  const ownerPart = encodeURIComponent(owner)
  const repoPart = encodeURIComponent(repo)
  const encodedPath = encodedVaultPath(path)
  const ref = encodedPath
    ? `/repos/${ownerPart}/${repoPart}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    : `/repos/${ownerPart}/${repoPart}/contents?ref=${encodeURIComponent(branch)}`
  const data = await githubFetch(ref)
  if (!Array.isArray(data)) return []
  return data.map((file: Record<string, unknown>) => ({
    path: file.path as string,
    name: file.name as string,
    type: (file.type as string) === 'dir' ? 'dir' : 'file',
    sha: file.sha as string,
    size: file.size as number,
  }))
}

async function readGithubFile(path: string): Promise<string> {
  const owner = process.env.VAULT_GITHUB_OWNER?.trim()
  const repo = process.env.VAULT_GITHUB_REPO?.trim()
  const branch = process.env.VAULT_GITHUB_BRANCH?.trim() || 'main'
  if (!owner || !repo) throw new Error('GitHub vault source not configured')

  const data = await githubFetch(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedVaultPath(path)}?ref=${encodeURIComponent(branch)}`
  )
  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }
  return data.content as string
}

// ── Tailscale proxy source ─────────────────────────────────────────────────

async function tailscaleFetch(endpoint: string) {
  const host = process.env.TAILSCALE_PROXY_HOST?.trim()
  const secret = process.env.TAILSCALE_PROXY_SECRET?.trim()
  if (!host || !secret) throw new Error('Tailscale vault source not configured')
  const res = await fetch(`http://${host}${endpoint}`, {
    headers: { 'x-proxy-secret': secret },
    next: { revalidate: 10 },
  })
  if (!res.ok) throw new Error(`Tailscale proxy ${res.status}`)
  return res.json()
}

async function listTailscalePath(path: string): Promise<VaultFile[]> {
  const data = await tailscaleFetch(`/api/list?path=${encodeURIComponent(path)}`)
  return Array.isArray(data.files) ? data.files as VaultFile[] : []
}

async function readTailscaleFile(path: string): Promise<string> {
  const data = await tailscaleFetch(`/api/read?path=${encodeURIComponent(path)}`)
  return data.content as string
}

// ── Public API ─────────────────────────────────────────────────────────────

function source(): 'github' | 'tailscale' {
  const configured = process.env.VAULT_SOURCE?.trim() || 'github'
  if (configured !== 'github' && configured !== 'tailscale') throw new Error('Unsupported vault source')
  return configured
}

async function listVaultPathUnsafe(path: string): Promise<VaultFile[]> {
  if (source() === 'tailscale') return listTailscalePath(path)
  return listGithubPath(path)
}

export async function listVaultPath(path = ''): Promise<VaultFile[]> {
  const safePath = normalizeVaultPath(path)
  return listVaultPathUnsafe(safePath)
}

export async function readVaultFile(path: string): Promise<string> {
  const safePath = normalizeVaultPath(path, { markdownOnly: true })
  if (source() === 'tailscale') return readTailscaleFile(safePath)
  return readGithubFile(safePath)
}

export async function walkVaultMd(
  path = '',
  maxDepth = 5,
  depth = 0
): Promise<VaultFile[]> {
  if (depth > maxDepth) return []
  const entries = await listVaultPath(path)
  const results: VaultFile[] = []
  for (const entry of entries) {
    if (entry.type === 'dir' && !entry.name.startsWith('.')) {
      const sub = await walkVaultMd(entry.path, maxDepth, depth + 1)
      results.push(...sub)
    } else if (entry.name.endsWith('.md')) {
      results.push(entry)
    }
  }
  return results
}

export async function getVaultHealth() {
  let selected: 'github' | 'tailscale'
  try {
    selected = source()
  } catch {
    return { ok: false, configured: false, source: 'invalid', reason: 'unsupported-source' }
  }

  const configured = selected === 'github'
    ? Boolean(process.env.VAULT_GITHUB_OWNER?.trim() && process.env.VAULT_GITHUB_REPO?.trim())
    : Boolean(process.env.TAILSCALE_PROXY_HOST?.trim() && process.env.TAILSCALE_PROXY_SECRET?.trim())

  if (!configured) return { ok: false, configured: false, source: selected, reason: 'not-configured' }

  try {
    const root = await listVaultPathUnsafe('')
    return { ok: true, configured: true, source: selected, rootEntries: root.length }
  } catch {
    return { ok: false, configured: true, source: selected, reason: 'unreachable' }
  }
}
