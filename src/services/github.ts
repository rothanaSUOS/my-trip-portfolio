/**
 * Minimal GitHub Contents API client.
 *
 * This is what makes "Add a trip" actually save. The browser commits the
 * updated `public/trips.json` (and any uploaded photos) straight to the repo;
 * the Pages workflow then rebuilds and the change is live. No server of our own,
 * no code editing.
 *
 * The token is a **fine-grained personal access token** with `Contents:
 * Read and write` on this one repository, entered once and kept in localStorage
 * on the owner's machine. It is never committed and never leaves the browser
 * except in requests to api.github.com. Anyone who can read that localStorage
 * can write to the repo — see SettingsDialog, which says so plainly.
 */

const API = 'https://api.github.com'

export interface GitHubConfig {
  owner: string
  repo: string
  branch: string
  token: string
}

/** A file's current content and blob sha, which the next write must echo back. */
export interface RemoteFile {
  /** Decoded UTF-8 text. Empty when the file does not exist yet. */
  text: string
  /** Blob sha, or null when the file does not exist yet. */
  sha: string | null
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

function headers(config: GitHubConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/**
 * Turns GitHub's error bodies into something worth showing a human.
 *
 * GitHub's own `message` is always appended rather than replaced. Its wording
 * ("Resource not accessible by personal access token" vs "Bad credentials" vs
 * "Not Found") is the only thing that distinguishes a missing permission from a
 * missing repository from an expired token, so swallowing it makes the error
 * impossible to act on.
 */
async function fail(response: Response): Promise<never> {
  let detail = ''
  try {
    const body = (await response.json()) as { message?: string }
    detail = body.message ?? ''
  } catch {
    // Non-JSON error body; the status alone will have to do.
  }

  const hint: Record<number, string> = {
    401: 'The token was rejected — check it has not expired, been revoked, or been pasted with a stray space.',
    403: 'GitHub refused this token. On a fine-grained token, check Repository permissions → Contents is set to "Read and write" (Metadata: Read-only must stay on too). On a classic token, it needs the "repo" scope.',
    404: 'Not found. Check the username and repository spelling, and that the token lists this repository under "Only select repositories".',
    409: 'The file changed on GitHub since this page loaded. Reload and try again.',
    422: 'GitHub rejected the write — usually a stale file version. Reload and try again.',
  }

  const parts = [hint[response.status], detail && `GitHub said: “${detail}”`].filter(Boolean)

  throw new GitHubError(
    parts.join(' ') || response.statusText || `Request failed (${response.status}).`,
    response.status,
  )
}

/** Base64 for arbitrary UTF-8 text — `btoa` alone throws on non-Latin-1. */
export function encodeText(text: string): string {
  const bytes = new TextEncoder().encode(text)
  return encodeBytes(bytes)
}

/** Base64 for binary data, chunked so large photos do not blow the call stack. */
export function encodeBytes(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }

  return btoa(binary)
}

function decodeText(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Verify the config before saving it.
 *
 * Two probes, because they fail for different reasons and the distinction is
 * what makes the error actionable:
 *
 *   1. `GET /repos/{owner}/{repo}` — needs Metadata: Read-only. Failing here
 *      means the repo name is wrong or the token cannot see this repo at all.
 *   2. `GET /contents/{DATA_PATH}` — needs Contents. Failing *only* here means
 *      the repo is visible but the Contents permission is missing.
 *
 * The repo's `permissions.push` flag is deliberately not used: for fine-grained
 * tokens it reports the *user's* role on the repo, not what the token is allowed
 * to do, so it passes for a Contents: Read-only token and proves nothing.
 *
 * Nothing here proves *write* access — GitHub has no dry-run for writes, and
 * this must not create a junk commit to find out. Write is confirmed by the
 * first real save.
 */
export async function checkAccess(config: GitHubConfig): Promise<{ defaultBranch: string }> {
  const repoResponse = await fetch(`${API}/repos/${config.owner}/${config.repo}`, {
    headers: headers(config),
  })

  if (!repoResponse.ok) await fail(repoResponse)

  const repo = (await repoResponse.json()) as { default_branch: string }

  // A 404 here is fine — it means the data file does not exist yet, which is
  // normal on a fresh repo. Anything else is a genuine access problem.
  const contents = await fetch(
    `${API}/repos/${config.owner}/${config.repo}/contents/public/trips.json?ref=${encodeURIComponent(config.branch || repo.default_branch)}`,
    { headers: headers(config) },
  )

  if (!contents.ok && contents.status !== 404) await fail(contents)

  return { defaultBranch: repo.default_branch }
}

/**
 * Read a file. A missing file resolves with empty text and a null sha rather
 * than throwing, so callers can treat "create" and "update" the same way.
 */
export async function readFile(config: GitHubConfig, path: string): Promise<RemoteFile> {
  const url = `${API}/repos/${config.owner}/${config.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(config.branch)}`
  const response = await fetch(url, { headers: headers(config) })

  if (response.status === 404) return { text: '', sha: null }
  if (!response.ok) await fail(response)

  const body = (await response.json()) as { content?: string; sha: string }
  return { text: body.content ? decodeText(body.content) : '', sha: body.sha }
}

/**
 * Create or update a file. `sha` must be the blob sha from the matching
 * `readFile` — GitHub rejects the write if someone else changed the file since,
 * which is what stops two devices silently overwriting each other.
 */
export async function writeFile(
  config: GitHubConfig,
  path: string,
  base64Content: string,
  message: string,
  sha: string | null,
): Promise<{ sha: string }> {
  const url = `${API}/repos/${config.owner}/${config.repo}/contents/${encodePath(path)}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(config), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  })

  if (!response.ok) await fail(response)

  const body = (await response.json()) as { content: { sha: string } }
  return { sha: body.content.sha }
}

/** One line of the setup report: what was checked, and what to do if it failed. */
export interface DiagnosticLine {
  label: string
  ok: boolean
  detail: string
}

/**
 * Answers "why is my photo not loading" with facts instead of guesses.
 *
 * Each check is a separate call because they fail for different reasons, and
 * knowing *which* one failed is the whole point — a private repo, a wrong branch
 * and a missing file all look identical from the browser otherwise.
 */
export async function diagnose(config: GitHubConfig): Promise<DiagnosticLine[]> {
  const lines: DiagnosticLine[] = []

  // 1. Repo reachable, and public? raw.githubusercontent only serves public repos.
  let defaultBranch = ''
  try {
    const response = await fetch(`${API}/repos/${config.owner}/${config.repo}`, {
      headers: headers(config),
    })
    if (!response.ok) await fail(response)

    const repo = (await response.json()) as { private: boolean; default_branch: string }
    defaultBranch = repo.default_branch

    lines.push({
      label: 'Repository',
      ok: !repo.private,
      detail: repo.private
        ? `${config.owner}/${config.repo} is private. Photos load from raw.githubusercontent.com, which only serves public repositories — so they will not appear until the deploy finishes. Make the repository public to fix it.`
        : `${config.owner}/${config.repo} is public.`,
    })
  } catch (error) {
    lines.push({
      label: 'Repository',
      ok: false,
      detail: error instanceof Error ? error.message : 'Could not reach the repository.',
    })
    return lines
  }

  // 2. Does the configured branch actually exist? A wrong branch here silently
  //    breaks every raw photo URL even though saving still appears to work.
  try {
    const response = await fetch(
      `${API}/repos/${config.owner}/${config.repo}/branches/${encodeURIComponent(config.branch)}`,
      { headers: headers(config) },
    )

    lines.push({
      label: 'Branch',
      ok: response.ok,
      detail: response.ok
        ? `“${config.branch}” exists.`
        : `“${config.branch}” does not exist in this repository. The default branch is “${defaultBranch}” — change it in the field above.`,
    })
  } catch {
    lines.push({ label: 'Branch', ok: false, detail: 'Could not check the branch.' })
  }

  // 3. The data file and the photo folder — proves saving actually landed.
  for (const [label, path] of [
    ['Trip data', 'public/trips.json'],
    ['Photo folder', 'public/photos'],
  ] as const) {
    try {
      const file = await readFile(config, path)
      const exists = file.sha !== null

      lines.push({
        label,
        ok: exists,
        detail: exists
          ? `${path} is in the repository.`
          : `${path} is not in the repository yet. For photos this is normal until you upload one.`,
      })
    } catch (error) {
      lines.push({
        label,
        ok: false,
        detail: error instanceof Error ? error.message : `Could not read ${path}.`,
      })
    }
  }

  return lines
}

/** Encode each path segment but keep the slashes. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
