import type { GitHubConfig } from '@/services/github'

/**
 * Where the site owner's GitHub credentials live.
 *
 * localStorage, on their machine only. Nothing here is bundled, committed or
 * sent anywhere except api.github.com. A visitor who has not configured
 * anything gets a plain read-only site — that is what `isConfigured()` gates.
 */

const KEY = 'wanderlog.github.v1'

export function loadConfig(): GitHubConfig | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<GitHubConfig>
    if (!parsed.owner || !parsed.repo || !parsed.token) return null

    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch || 'main',
      token: parsed.token,
    }
  } catch {
    return null
  }
}

export function saveConfig(config: GitHubConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(config))
  } catch {
    // Private mode or a full quota. The caller keeps working for this session;
    // only persistence across reloads is lost.
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing useful to do.
  }
}

export function isConfigured(): boolean {
  return loadConfig() !== null
}

/**
 * Best-effort guess at owner/repo from the page URL, so the settings form comes
 * pre-filled on a `*.github.io/<repo>/` deployment.
 */
export function guessRepoFromLocation(): { owner: string; repo: string } {
  const host = window.location.hostname
  const owner = host.endsWith('.github.io') ? host.replace('.github.io', '') : ''

  const firstSegment = window.location.pathname.split('/').filter(Boolean)[0] ?? ''
  const repo = owner ? firstSegment : ''

  return { owner, repo }
}
