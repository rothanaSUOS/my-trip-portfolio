<script lang="ts">
import { defineComponent } from 'vue'

import PhotoLightbox from '@/components/PhotoLightbox.vue'
import TripDetailDialog from '@/components/TripDetailDialog.vue'
import TripEditorDialog from '@/components/TripEditorDialog.vue'
import TripFilters from '@/components/TripFilters.vue'
import TripGrid from '@/components/TripGrid.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import {
  deleteTrip as removeTrip,
  loadTrips,
  pendingCount,
  saveTrip,
  uploadPhoto,
} from '@/services/tripStore'
import { makePreviewDataUrl } from '@/services/images'
import { setPreview } from '@/services/photoPreviews'
import { isConfigured } from '@/services/settings'
import { byDateDescending, yearOf } from '@/utils/date'
import type { LifeChapter, Trip, TripStats } from '@/types/trip'

/**
 * Root component. Owns all page state — the trip list, filters, which trip is
 * open, which photo the lightbox shows — so child components stay presentational
 * and there is one place to look when the timeline shows the wrong thing.
 */
export default defineComponent({
  name: 'App',

  components: {
    PhotoLightbox,
    TripDetailDialog,
    TripEditorDialog,
    SettingsDialog,
    TripFilters,
    TripGrid,
  },

  data() {
    return {
      /** The deployed trip list, with any not-yet-deployed changes merged in. */
      allTrips: [] as Trip[],
      /** Changes committed but not yet visible in the deployed data. */
      deployingCount: 0,
      loading: true,
      loadError: '',

      /** True once a GitHub token is configured — gates all editing UI. */
      canEdit: false,
      settingsOpen: false,

      /** Poll handle used while a commit is deploying. */
      deployPoll: null as number | null,
      /** Stops the poll after a while so a failed deploy does not poll forever. */
      pollsLeft: 0,

      /** In-flight commit state for the editor dialog. */
      saving: false,
      saveError: '',
      deleting: false,

      search: '',
      selectedChapters: [] as LifeChapter[],
      selectedCountry: null as string | null,

      openTrip: null as Trip | null,
      detailOpen: false,

      lightboxOpen: false,
      lightboxIndex: 0,

      editorOpen: false,
      /** Trip being edited, or null when creating a new one. */
      editingTrip: null as Trip | null,

      deleteTarget: null as Trip | null,

      showBackToTop: false,
    }
  },

  computed: {
    /** Every trip, newest first. Filters work off this. */
    sortedTrips(): Trip[] {
      return [...this.allTrips].sort(byDateDescending)
    },

    filteredTrips(): Trip[] {
      const query = this.search.trim().toLowerCase()

      return this.sortedTrips.filter((trip) => {
        if (this.selectedChapters.length && !this.selectedChapters.includes(trip.chapter)) {
          return false
        }

        if (this.selectedCountry && trip.location.country !== this.selectedCountry) {
          return false
        }

        if (!query) return true

        return this.searchCorpus(trip).includes(query)
      })
    },

    /** Countries present in the data, alphabetical, for the filter select. */
    countries(): string[] {
      const names = new Set(this.sortedTrips.map((trip) => trip.location.country))
      return [...names].sort((a, b) => a.localeCompare(b))
    },

    /** Header numbers. Always describes the whole collection, not the filtered view. */
    stats(): TripStats {
      const years = this.sortedTrips.map((trip) => yearOf(trip.date))
      const firstYear = years.length ? Math.min(...years) : 0
      const lastYear = years.length ? Math.max(...years) : 0

      return {
        tripCount: this.sortedTrips.length,
        countryCount: this.countries.length,
        photoCount: this.sortedTrips.reduce((total, trip) => total + trip.photos.length, 0),
        yearSpan: years.length ? lastYear - firstYear + 1 : 0,
        firstYear,
        lastYear,
      }
    },

    /** Photos of whichever trip is open — what the lightbox pages through. */
    lightboxPhotos() {
      return this.openTrip?.photos ?? []
    },
  },

  mounted() {
    this.canEdit = isConfigured()
    void this.refresh()
    window.addEventListener('scroll', this.onScroll, { passive: true })
  },

  beforeUnmount() {
    window.removeEventListener('scroll', this.onScroll)
    this.stopDeployPoll()
  },

  methods: {
    /** Re-read the deployed data. Called on load and after every commit. */
    async refresh() {
      this.loadError = ''

      try {
        this.allTrips = await loadTrips()
      } catch (error) {
        this.loadError =
          error instanceof Error ? error.message : 'Could not load the trip data.'
      } finally {
        this.loading = false
        this.deployingCount = pendingCount()

        // Anything still pending means a deploy is in flight; watch for it so the
        // page updates itself rather than asking for a reload.
        if (this.deployingCount) this.startDeployPoll()
        else this.stopDeployPoll()
      }
    },

    /**
     * Re-check the deployed data until it catches up with what we committed.
     *
     * 20s is comfortably shorter than a Pages build and cheap — one small JSON
     * fetch. It gives up after ~5 minutes, because past that the deploy has
     * almost certainly failed and polling forever would hide that.
     */
    startDeployPoll() {
      if (this.deployPoll !== null) return

      this.pollsLeft = 15
      this.deployPoll = window.setInterval(() => {
        if (this.pollsLeft-- <= 0) {
          this.stopDeployPoll()
          return
        }
        void this.refresh()
      }, 20_000)
    },

    stopDeployPoll() {
      if (this.deployPoll === null) return

      window.clearInterval(this.deployPoll)
      this.deployPoll = null
    },

    onSettingsChanged() {
      this.canEdit = isConfigured()
    },

    /** Lowercased haystack of everything a search should match. */
    searchCorpus(trip: Trip): string {
      return [
        trip.title,
        trip.description,
        trip.location.name,
        trip.location.country,
        ...(trip.tags ?? []),
        ...(trip.highlights ?? []),
      ]
        .join(' ')
        .toLowerCase()
    },

    resetFilters() {
      this.search = ''
      this.selectedChapters = []
      this.selectedCountry = null
    },

    // ── Detail ───────────────────────────────────────────────────────────

    openDetail(trip: Trip) {
      this.openTrip = trip
      this.detailOpen = true
    },

    /**
     * Photo grid click. The detail dialog stays mounted underneath so closing
     * the lightbox returns to the trip rather than to the timeline.
     */
    openLightbox(index: number) {
      this.lightboxIndex = index
      this.lightboxOpen = true
    },

    // ── Editing ──────────────────────────────────────────────────────────

    startCreate() {
      this.editingTrip = null
      this.editorOpen = true
    },

    startEdit(trip: Trip) {
      this.editingTrip = trip
      this.editorOpen = true
    },

    /** Jump from reading a trip straight into editing it. */
    editOpenTrip() {
      if (!this.openTrip) return
      this.detailOpen = false
      this.startEdit(this.openTrip)
    },

    /**
     * Commit a trip. Photos go up first so the trip is never written pointing at
     * an image that does not exist yet; if a photo fails, nothing is saved.
     */
    async handleSave(payload: { trip: Trip; uploads: { path: string; bytes: Uint8Array }[] }) {
      this.saving = true
      this.saveError = ''

      try {
        for (const upload of payload.uploads) {
          await uploadPhoto(upload.bytes, upload.path, `Add photo for ${payload.trip.title}`)

          // The committed file is not fetchable until the deploy lands (and never
          // from a dev server), so keep a local stand-in to render meanwhile.
          try {
            setPreview(upload.path, await makePreviewDataUrl(upload.bytes))
          } catch {
            // A missing preview only means the card shows a placeholder until the
            // deploy finishes — not worth failing the save over.
          }
        }

        await saveTrip(payload.trip)

        this.editorOpen = false
        if (this.openTrip?.id === payload.trip.id) this.openTrip = payload.trip
        await this.refresh()
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : 'Could not save to GitHub.'
      } finally {
        this.saving = false
      }
    },

    confirmDelete(trip: Trip) {
      this.deleteTarget = trip
    },

    async handleDelete() {
      if (!this.deleteTarget) return

      const id = this.deleteTarget.id
      this.deleting = true

      try {
        await removeTrip(id)

        if (this.openTrip?.id === id) {
          this.detailOpen = false
          this.openTrip = null
        }
        this.deleteTarget = null
        await this.refresh()
      } catch (error) {
        this.loadError = error instanceof Error ? error.message : 'Could not delete on GitHub.'
      } finally {
        this.deleting = false
      }
    },

    // ── Scroll ───────────────────────────────────────────────────────────

    onScroll() {
      this.showBackToTop = window.scrollY > 800
    },

    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  },
})
</script>

<template>
  <v-app>
    <v-main>
      <!-- ── Hero ─────────────────────────────────────────────────────── -->
      <header class="hero">
        <div class="hero__sky" aria-hidden="true" />

        <div class="hero__inner">
          <p class="font-meta hero__eyebrow">{{ stats.firstYear }} — {{ stats.lastYear }}</p>

          <h1 class="font-display hero__title">
            A life in <strong>trips</strong>
          </h1>

          <p class="hero__lede">
            Every journey I remember, from childhood holidays to last — With this memory log, I can see the world through the lens of my own life. Each trip is a story, each photo a memory, and together they form a tapestry of experiences that define who I am.
          </p>

          <div class="hero__actions">
            <v-btn
              v-if="canEdit"
              color="primary"
              size="large"
              prepend-icon="$plus"
              @click="startCreate"
            >
              Add a trip
            </v-btn>
            <v-btn
              :variant="canEdit ? 'text' : 'outlined'"
              size="large"
              color="primary"
              prepend-icon="$settings"
              @click="settingsOpen = true"
            >
              {{ canEdit ? 'Settings' : 'Connect to publish' }}
            </v-btn>
          </div>

          <dl class="hero__stats">
            <div class="hero__stat">
              <dd class="font-display">{{ stats.tripCount }}</dd>
              <dt class="font-meta">Trips</dt>
            </div>
            <div class="hero__stat">
              <dd class="font-display">{{ stats.countryCount }}</dd>
              <dt class="font-meta">Countries</dt>
            </div>
            <div class="hero__stat">
              <dd class="font-display">{{ stats.photoCount }}</dd>
              <dt class="font-meta">Photos</dt>
            </div>
            <div class="hero__stat">
              <dd class="font-display">{{ stats.yearSpan }}</dd>
              <dt class="font-meta">Years</dt>
            </div>
          </dl>
        </div>
      </header>

      <!-- ── Timeline ─────────────────────────────────────────────────── -->
      <div class="page">
        <v-alert
          v-if="loadError"
          type="error"
          variant="tonal"
          rounded="lg"
          class="page__notice"
          density="comfortable"
        >
          {{ loadError }}
        </v-alert>

        <v-alert
          v-if="deployingCount"
          type="info"
          variant="tonal"
          rounded="lg"
          class="page__notice"
          density="comfortable"
        >
          {{ deployingCount }}
          {{ deployingCount === 1 ? 'change is' : 'changes are' }}
          committed and deploying — live in about a minute.
          <template v-if="pollsLeft > 0">
            This page updates itself when it lands; nothing for you to do.
          </template>
          <template v-else>
            Still not live — check the Actions tab on your repository.
          </template>
        </v-alert>

        <TripFilters
          v-model:search="search"
          v-model:chapters="selectedChapters"
          v-model:country="selectedCountry"
          :countries="countries"
          :result-count="filteredTrips.length"
          :total-count="sortedTrips.length"
          @reset="resetFilters"
        />

        <TripGrid
          v-if="!loading"
          :trips="filteredTrips"
          :editable="canEdit"
          @open="openDetail"
          @edit="startEdit"
          @remove="confirmDelete"
        />

        <div v-else class="page__loading">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <div v-if="!loading && !sortedTrips.length && !loadError" class="page__empty">
          <p class="font-display page__empty-title">No trips yet</p>
          <p class="page__empty-text">Start with the one you remember best.</p>
          <v-btn v-if="canEdit" color="primary" prepend-icon="$plus" @click="startCreate">
            Add a trip
          </v-btn>
          <v-btn v-else color="primary" prepend-icon="$settings" @click="settingsOpen = true">
            Connect to publish
          </v-btn>
        </div>
      </div>

      <footer class="site-footer">
        <span class="font-meta">May My Travel Never End © {{ new Date().getFullYear() }}</span>
      </footer>
    </v-main>

    <!-- ── Overlays ───────────────────────────────────────────────────── -->
    <TripDetailDialog
      v-model="detailOpen"
      :trip="openTrip"
      :editable="canEdit"
      @view-photo="openLightbox"
      @edit="editOpenTrip"
    />

    <PhotoLightbox
      v-model="lightboxOpen"
      v-model:index="lightboxIndex"
      :photos="lightboxPhotos"
      :title="openTrip?.title ?? ''"
    />

    <TripEditorDialog
      v-model="editorOpen"
      :trip="editingTrip"
      :existing-trips="allTrips"
      :saving="saving"
      :save-error="saveError"
      @save="handleSave"
    />

    <SettingsDialog v-model="settingsOpen" @changed="onSettingsChanged" />

    <v-dialog :model-value="deleteTarget !== null" max-width="420" @update:model-value="deleteTarget = null">
      <v-card class="pa-2">
        <v-card-title class="font-display">Delete this trip?</v-card-title>
        <v-card-text>
          “{{ deleteTarget?.title }}” will be committed as deleted and disappear from the
          published site once the deploy finishes. Its photo files stay in the repository.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="deleting" @click="deleteTarget = null">Cancel</v-btn>
          <v-btn color="error" prepend-icon="$trash" :loading="deleting" @click="handleDelete">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-fade-transition>
      <v-btn
        v-show="showBackToTop"
        icon="$arrowUp"
        size="small"
        color="primary"
        class="back-to-top"
        aria-label="Back to top"
        @click="scrollToTop"
      />
    </v-fade-transition>
  </v-app>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────────────────────── */

.hero {
  position: relative;
  overflow: hidden;
  text-align: center;
}

/* Soft sky gradient behind the masthead, echoing the reference posters. */
.hero__sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(120% 90% at 50% -10%, #cfe7f2 0%, rgba(207, 231, 242, 0) 60%),
    linear-gradient(180deg, #e7f2f7 0%, rgb(var(--v-theme-background)) 78%);
}

.hero__inner {
  position: relative;
  max-width: 1180px;
  margin: 0 auto;
  padding: clamp(3.5rem, 10vw, 6.5rem) 1.25rem clamp(2.5rem, 6vw, 4rem);
}

.hero__eyebrow {
  color: rgb(var(--v-theme-accent));
  letter-spacing: 0.3em;
  margin-bottom: 1rem;
}

.hero__title {
  font-size: clamp(2.5rem, 9vw, 5rem);
  color: rgb(var(--v-theme-primary));
  margin-bottom: 1.25rem;
}

.hero__lede {
  max-width: 46ch;
  margin: 0 auto;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: clamp(0.95rem, 2.5vw, 1.1rem);
  line-height: 1.75;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 2rem;
}

.hero__stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: clamp(1.25rem, 5vw, 3rem);
  margin-top: clamp(2.5rem, 6vw, 3.5rem);
  padding: 1.5rem clamp(1rem, 4vw, 2.5rem);
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(8px);
  border-radius: var(--radius-lg);
  width: fit-content;
  margin-inline: auto;
}

.hero__stat dd {
  font-size: clamp(1.6rem, 5vw, 2.25rem);
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  margin: 0 0 0.15rem;
  line-height: 1;
}

.hero__stat dt {
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ── Page ─────────────────────────────────────────────────────────────── */

.page {
  max-width: 1180px;
  margin: 0 auto;
  padding-inline: 1.25rem;
}

.page__notice {
  margin-bottom: 1.25rem;
}

.page__loading {
  display: flex;
  justify-content: center;
  padding: 5rem 1rem;
}

.page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem 6rem;
  text-align: center;
}

.page__empty-title {
  font-size: 1.75rem;
  color: rgb(var(--v-theme-primary));
}

.page__empty-text {
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 0.5rem;
}

.site-footer {
  display: flex;
  justify-content: center;
  padding: 2.5rem 1.25rem 3.5rem;
  color: rgb(var(--v-theme-on-surface-variant));
  border-top: 1px solid rgb(var(--v-theme-surface-variant));
}

/* Sits clear of the iOS home indicator on phones. */
.back-to-top {
  position: fixed;
  right: 1rem;
  bottom: calc(1rem + env(safe-area-inset-bottom));
  z-index: 1500;
}

code {
  padding: 0.1rem 0.35rem;
  border-radius: 5px;
  background: rgb(var(--v-theme-surface-bright));
  font-size: 0.85em;
}
</style>
