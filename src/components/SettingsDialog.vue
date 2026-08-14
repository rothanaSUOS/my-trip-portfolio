<script lang="ts">
import { defineComponent } from 'vue'

import { checkAccess, diagnose, type DiagnosticLine, type GitHubConfig } from '@/services/github'
import { clearConfig, guessRepoFromLocation, loadConfig, saveConfig } from '@/services/settings'

/**
 * Connects the site to its own repository so the editor can publish.
 *
 * Deliberately explicit about what the token can do and where it is kept — this
 * asks someone to paste a credential into a web page, and the only honest way
 * to do that is to say exactly what happens to it.
 */
export default defineComponent({
  name: 'SettingsDialog',

  props: {
    modelValue: { type: Boolean, default: false },
  },

  emits: {
    'update:modelValue': (value: boolean) => typeof value === 'boolean',
    /** Config was connected or disconnected — App reloads its trips. */
    changed: () => true,
  },

  data() {
    return {
      owner: '',
      repo: '',
      branch: 'main',
      token: '',
      showToken: false,

      testing: false,
      checking: false,
      /** Result of the last "Check setup" run. */
      report: [] as DiagnosticLine[],
      /** '' | 'ok' | error message */
      status: '' as string,
      connected: false,
    }
  },

  computed: {
    canTest(): boolean {
      return Boolean(this.owner.trim() && this.repo.trim() && this.token.trim()) && !this.testing
    },

    tokenUrl(): string {
      return 'https://github.com/settings/personal-access-tokens/new'
    },
  },

  watch: {
    modelValue: {
      immediate: true,
      handler(open: boolean) {
        if (open) this.reset()
      },
    },
  },

  methods: {
    reset() {
      this.status = ''
      this.showToken = false
      this.report = []

      const existing = loadConfig()
      this.connected = existing !== null

      if (existing) {
        this.owner = existing.owner
        this.repo = existing.repo
        this.branch = existing.branch
        this.token = existing.token
        return
      }

      const guess = guessRepoFromLocation()
      this.owner = guess.owner
      this.repo = guess.repo
      this.branch = 'main'
      this.token = ''
    },

    config(): GitHubConfig {
      return {
        owner: this.owner.trim(),
        repo: this.repo.trim(),
        branch: this.branch.trim() || 'main',
        token: this.token.trim(),
      }
    },

    /** Verifies write access before storing anything, so a bad token fails here. */
    async connect() {
      this.testing = true
      this.status = ''

      try {
        const config = this.config()
        const { defaultBranch } = await checkAccess(config)

        // Nudge the branch to whatever the repo actually uses, so a default of
        // "main" does not silently fail on a "master" repo.
        if (!this.branch.trim()) config.branch = defaultBranch

        saveConfig(config)
        this.connected = true
        this.status = 'ok'
        this.$emit('changed')
      } catch (error) {
        this.status = error instanceof Error ? error.message : 'Could not reach GitHub.'
      } finally {
        this.testing = false
      }
    },

    /** Runs the setup checks and shows exactly which one fails. */
    async runDiagnostics() {
      this.checking = true
      this.report = []

      try {
        this.report = await diagnose(this.config())
      } catch (error) {
        this.status = error instanceof Error ? error.message : 'Could not run the checks.'
      } finally {
        this.checking = false
      }
    },

    disconnect() {
      clearConfig()
      this.connected = false
      this.token = ''
      this.status = ''
      this.$emit('changed')
    },

    close() {
      this.$emit('update:modelValue', false)
    },
  },
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="620"
    :fullscreen="$vuetify.display.smAndDown"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="settings">
      <div class="settings__head">
        <div>
          <p class="font-meta settings__eyebrow">Settings</p>
          <h2 class="font-display settings__title">Publish from this page</h2>
        </div>
        <v-btn icon="$close" size="small" variant="text" aria-label="Close" @click="close" />
      </div>

      <v-card-text class="settings__body">
        <p class="settings__lede">
          Connect this site to its own GitHub repository and the editor saves for real:
          adding a trip commits it, GitHub Actions rebuilds, and it is live in about a minute.
          Without this, the site is read-only.
        </p>

        <v-alert
          v-if="connected"
          type="success"
          variant="tonal"
          rounded="lg"
          density="comfortable"
          class="mb-4"
        >
          Connected to <strong>{{ owner }}/{{ repo }}</strong> on <strong>{{ branch }}</strong>.
        </v-alert>

        <div class="settings__row">
          <v-text-field v-model="owner" label="GitHub username" placeholder="rothana" />
          <v-text-field v-model="repo" label="Repository" placeholder="my-trip-portfolio" />
          <v-text-field v-model="branch" label="Branch" placeholder="main" style="max-width: 140px" />
        </div>

        <v-text-field
          v-model="token"
          :type="showToken ? 'text' : 'password'"
          label="Access token"
          placeholder="github_pat_…"
          autocomplete="off"
          spellcheck="false"
          :append-inner-icon="showToken ? '$eyeOff' : '$eye'"
          @click:append-inner="showToken = !showToken"
        />

        <details class="settings__how" open>
          <summary>How to make the token</summary>
          <ol>
            <li>
              Open
              <a :href="tokenUrl" target="_blank" rel="noopener noreferrer">
                GitHub → fine-grained tokens → Generate new
              </a>
            </li>
            <li>
              <strong>Repository access</strong> → “Only select repositories” → pick this repo.
              (“Public repositories” is read-only and will not work.)
            </li>
            <li>
              <strong>Repository permissions</strong> → scroll to <strong>Contents</strong> → change
              it from “No access” to <strong>Read and write</strong>. This is the only permission
              you need to set, and the step that is usually missed — the list is long and
              everything starts at “No access”.
            </li>
            <li>
              <strong>Metadata</strong> will show as “Read-only” and be greyed out. That is normal
              — GitHub adds it automatically and it cannot be changed. Leave it alone.
            </li>
            <li>Generate, copy the token, and paste it above.</li>
          </ol>
          <p class="settings__note">
            Using a <em>classic</em> token instead? It needs the whole <code>repo</code> scope.
          </p>
        </details>

        <v-alert type="warning" variant="tonal" rounded="lg" density="comfortable" class="mt-4">
          <p class="settings__warn">
            The token is stored in this browser's local storage, on this device only. It is
            never committed and is only ever sent to api.github.com. Anyone who can use this
            browser can use the token to write to the repository — so do not do this on a
            shared or public computer, and give the token access to this one repository only.
          </p>
        </v-alert>

        <div v-if="report.length" class="report">
          <p
            v-for="line in report"
            :key="line.label"
            class="report__line"
            :class="{ 'report__line--bad': !line.ok }"
          >
            <v-icon :icon="line.ok ? '$check' : '$alert'" size="16" />
            <span><strong>{{ line.label }}:</strong> {{ line.detail }}</span>
          </p>
        </div>

        <v-alert
          v-if="status && status !== 'ok'"
          type="error"
          variant="tonal"
          rounded="lg"
          density="comfortable"
          class="mt-4"
        >
          {{ status }}
        </v-alert>
      </v-card-text>

      <v-card-actions class="settings__actions">
        <v-btn v-if="connected" variant="text" color="error" @click="disconnect">Disconnect</v-btn>
        <v-btn
          v-if="connected"
          variant="text"
          :loading="checking"
          @click="runDiagnostics"
        >
          Check setup
        </v-btn>
        <v-spacer />
        <v-btn variant="text" @click="close">Close</v-btn>
        <v-btn color="primary" :loading="testing" :disabled="!canTest" @click="connect">
          {{ connected ? 'Update' : 'Connect' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.settings {
  background: rgb(var(--v-theme-background));
}

.settings__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem 0.5rem;
}

.settings__eyebrow {
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.3rem;
}

.settings__title {
  font-size: 1.5rem;
  color: rgb(var(--v-theme-primary));
}

.settings__body {
  padding: 0.5rem 1.5rem 1rem;
}

.settings__lede {
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 1.25rem;
}

.settings__row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.settings__row > * {
  flex: 1 1 0;
  min-width: 0;
}

.settings__how {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.settings__how summary {
  cursor: pointer;
  color: rgb(var(--v-theme-primary));
  font-weight: 500;
}

.settings__how ol {
  margin: 0.75rem 0 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  line-height: 1.55;
}

.settings__note {
  margin-top: 0.6rem;
}

.settings__note code {
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  background: rgb(var(--v-theme-surface-bright));
}

.settings__warn {
  font-size: 0.82rem;
  line-height: 1.6;
}

.report {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: rgb(var(--v-theme-surface));
}

.report__line {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: rgb(var(--v-theme-on-surface-variant));
}

.report__line :deep(.v-icon) {
  color: rgb(var(--v-theme-success));
  flex: 0 0 auto;
  margin-top: 0.15rem;
}

.report__line--bad :deep(.v-icon) {
  color: rgb(var(--v-theme-error));
}

.settings__actions {
  padding: 0.75rem 1.5rem 1.25rem;
}

@media (max-width: 599px) {
  .settings__row {
    flex-direction: column;
  }

  .settings__row > * {
    width: 100%;
    max-width: none !important;
  }
}
</style>
