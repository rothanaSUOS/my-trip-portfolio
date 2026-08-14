<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import {
  isGooglePhotosAlbumLink,
  isSessionBoundPhotoUrl,
  rawPhotoUrl,
  resolvePhotoSrcset,
  resolvePhotoUrl,
  type PhotoSize,
} from '@/services/photos'
import type { Photo } from '@/types/trip'

/**
 * A single trip photo. Owns everything image-related — size resolution,
 * srcset, lazy loading, aspect ratio, load/error state — so no other component
 * touches `resolvePhotoUrl` directly.
 */
export default defineComponent({
  name: 'TripPhoto',

  props: {
    photo: { type: Object as PropType<Photo>, required: true },
    /** Which entry of PHOTO_SIZES to request. */
    size: { type: String as PropType<PhotoSize>, default: 'grid' },
    /**
     * width / height. Pass 0 to use the photo's own shape — the box then takes
     * its ratio from `photo.width/height` when those are known, so it reserves
     * the right height before the image loads.
     */
    aspectRatio: { type: Number, default: 4 / 3 },
    /**
     * Stretch to fill the parent instead of holding an aspect ratio. Card
     * templates use this so every tile in the grid ends up the same height —
     * the photo absorbs whatever space the text does not use.
     */
    fill: { type: Boolean, default: false },
    /** First-screen images should load eagerly; everything else lazily. */
    eager: { type: Boolean, default: false },
    rounded: { type: Boolean, default: true },
  },

  data() {
    return {
      /** Set when the browser fails to fetch the image, fallback included. */
      failed: false,
      /** Switched on after the served copy 404s, to retry straight from GitHub. */
      usingRaw: false,
      loaded: false,
    }
  },

  computed: {
    src(): string {
      if (this.usingRaw && this.rawSrc) return this.rawSrc
      return resolvePhotoUrl(this.photo.url, this.size)
    },

    /**
     * The same photo straight from the repo. Used when the served copy is not
     * there yet — before the deploy lands, or on a dev server where the file
     * only ever went to GitHub.
     */
    rawSrc(): string {
      return rawPhotoUrl(this.photo.url)
    },

    /**
     * The ratio the box should hold, or null to let the image size itself.
     * An explicit `aspectRatio` wins; otherwise the photo's own shape is used.
     */
    boxRatio(): number | null {
      if (this.fill) return null
      if (this.aspectRatio) return this.aspectRatio

      const { width, height } = this.photo
      return width && height ? width / height : null
    },

    srcset(): string {
      // The raw file has no size variants.
      if (this.usingRaw) return ''
      return resolvePhotoSrcset(this.photo.url, this.size)
    },

    /**
     * Album share links point at an HTML page, so the <img> would silently fail.
     * Detect it up front and show the same explanatory placeholder as a 404.
     */
    isAlbumLink(): boolean {
      return isGooglePhotosAlbumLink(this.photo.url)
    },

    broken(): boolean {
      return this.failed || this.isAlbumLink || !this.photo.url.trim()
    },

    hint(): string {
      if (this.isAlbumLink) return 'Album link — needs a direct image URL'
      if (!this.photo.url.trim()) return 'No image URL set'

      // Loads for whoever copied it, 404s for everyone else — so say that,
      // rather than a generic failure the owner cannot reproduce.
      if (isSessionBoundPhotoUrl(this.photo.url)) {
        return 'Link tied to a Google account — upload the file instead'
      }

      // Both the served copy and the repo copy failed. For a repo path that
      // usually means the repo is private, or the branch name is wrong.
      if (!/^https?:\/\//i.test(this.photo.url.trim())) {
        return 'Photo not reachable — open Settings → Check setup'
      }

      return 'Image failed to load'
    },
  },

  watch: {
    // Reused across trips inside the lightbox, so start clean on a new photo.
    'photo.url'() {
      this.failed = false
      this.usingRaw = false
      this.loaded = false
    },
  },

  methods: {
    onLoad() {
      this.loaded = true
    },

    /**
     * First failure on a repo-relative path retries against raw.githubusercontent;
     * only a second failure counts as broken. Keyed off `usingRaw` rather than a
     * counter so it can never loop.
     */
    onError() {
      if (!this.usingRaw && this.rawSrc) {
        this.usingRaw = true
        this.loaded = false
        return
      }

      this.failed = true
    },
  },
})
</script>

<template>
  <div
    class="trip-photo"
    :class="{
      'trip-photo--rounded': rounded,
      'trip-photo--loaded': loaded,
      'trip-photo--fill': fill,
    }"
    :style="boxRatio ? { aspectRatio: String(boxRatio) } : undefined"
  >
    <div v-if="broken" class="trip-photo__fallback font-meta">
      <v-icon icon="$imageOff" size="28" />
      <span>{{ hint }}</span>
    </div>

    <img
      v-else
      class="trip-photo__img"
      :src="src"
      :srcset="srcset || undefined"
      :alt="photo.alt"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : 'auto'"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.trip-photo {
  position: relative;
  overflow: hidden;
  width: 100%;
  background: rgb(var(--v-theme-surface-bright));
}

.trip-photo--rounded {
  border-radius: 6px;
}

/* Fills whatever box the template gives it; the img crops rather than letterboxes. */
.trip-photo--fill {
  height: 100%;
  min-height: 0;
}

.trip-photo__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.trip-photo--loaded .trip-photo__img {
  opacity: 1;
}

.trip-photo__fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  min-height: 120px;
  padding: 1rem;
  text-align: center;
  color: rgb(var(--v-theme-on-surface-variant));
  border: 1px dashed rgb(var(--v-theme-surface-variant));
  border-radius: inherit;
}
</style>
