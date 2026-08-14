<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import type { Photo } from '@/types/trip'

/**
 * Full-screen photo viewer with keyboard and swipe navigation.
 *
 * Controlled by `modelValue` (open/closed) and `index` (which photo), both of
 * which the parent owns so the dialog can be opened straight onto a photo.
 */
export default defineComponent({
  name: 'PhotoLightbox',

  components: { TripPhoto },

  props: {
    modelValue: { type: Boolean, default: false },
    photos: { type: Array as PropType<Photo[]>, required: true },
    index: { type: Number, default: 0 },
    /** Shown in the corner, e.g. the trip title. */
    title: { type: String, default: '' },
  },

  emits: {
    'update:modelValue': (value: boolean) => typeof value === 'boolean',
    'update:index': (value: number) => Number.isInteger(value),
  },

  data() {
    return {
      /** Horizontal distance of an in-progress touch drag, for swipe detection. */
      touchStartX: 0,
    }
  },

  computed: {
    current(): Photo | undefined {
      return this.photos[this.index]
    },

    hasMultiple(): boolean {
      return this.photos.length > 1
    },

    counter(): string {
      return `${this.index + 1} / ${this.photos.length}`
    },
  },

  watch: {
    /**
     * Arrow keys are bound on `window` rather than on the dialog: Vuetify's
     * overlay teleports its content to <body> and focus lands on the close
     * button, so a keydown handler in this template only fires while that
     * button is focused.
     */
    modelValue: {
      immediate: true,
      handler(open: boolean) {
        if (open) {
          window.addEventListener('keydown', this.onKeydown)
        } else {
          window.removeEventListener('keydown', this.onKeydown)
        }
      },
    },
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
  },

  methods: {
    onKeydown(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        this.step(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        this.step(1)
      }
      // Escape is left to Vuetify's own overlay handling.
    },

    close() {
      this.$emit('update:modelValue', false)
    },

    /** Wraps around at both ends so arrow keys never dead-end. */
    step(delta: number) {
      if (!this.hasMultiple) return
      const next = (this.index + delta + this.photos.length) % this.photos.length
      this.$emit('update:index', next)
    },

    onTouchStart(event: TouchEvent) {
      this.touchStartX = event.changedTouches[0]?.clientX ?? 0
    },

    onTouchEnd(event: TouchEvent) {
      const endX = event.changedTouches[0]?.clientX ?? 0
      const distance = endX - this.touchStartX

      // 50px threshold keeps a tap or a vertical scroll from paging the photo.
      if (Math.abs(distance) < 50) return
      this.step(distance < 0 ? 1 : -1)
    },
  },
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    transition="fade-transition"
    :scrim="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div
      class="lightbox"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
      @click.self="close"
    >
      <header class="lightbox__bar">
        <span class="font-meta lightbox__title">{{ title }}</span>
        <span v-if="hasMultiple" class="font-meta lightbox__counter">{{ counter }}</span>
        <v-btn icon="$close" size="small" aria-label="Close photo" @click="close" />
      </header>

      <div class="lightbox__stage" @click.self="close">
        <TripPhoto
          v-if="current"
          :key="current.id"
          :photo="current"
          size="full"
          :aspect-ratio="0"
          :rounded="false"
          eager
          class="lightbox__photo"
        />
      </div>

      <footer class="lightbox__footer">
        <p v-if="current?.caption" class="lightbox__caption">{{ current.caption }}</p>
      </footer>

      <template v-if="hasMultiple">
        <v-btn
          icon="$prev"
          class="lightbox__nav lightbox__nav--prev"
          aria-label="Previous photo"
          @click="step(-1)"
        />
        <v-btn
          icon="$next"
          class="lightbox__nav lightbox__nav--next"
          aria-label="Next photo"
          @click="step(1)"
        />
      </template>
    </div>
  </v-dialog>
</template>

<style scoped>
.lightbox {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  /* Fully opaque: the trip dialog stays mounted underneath and would otherwise
     show through behind the photo. */
  background: #060608;
  /* Respect notches and the iOS home indicator in fullscreen. */
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}

.lightbox__bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.lightbox__counter {
  white-space: nowrap;
}

.lightbox__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgb(var(--v-theme-accent));
}

.lightbox__stage {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 0 1rem;
}

.lightbox__photo {
  width: auto;
  max-width: min(100%, 1600px);
  background: transparent;
}

.lightbox__photo :deep(.trip-photo__img) {
  width: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.lightbox__footer {
  min-height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
}

.lightbox__caption {
  max-width: 60ch;
  text-align: center;
  font-size: 0.9rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(20, 20, 24, 0.7);
}

.lightbox__nav--prev {
  left: 0.5rem;
}

.lightbox__nav--next {
  right: 0.5rem;
}

/* On phones the arrows would sit over the photo, so drop them and rely on
   swipe — the counter in the bar still communicates that there is more. */
@media (max-width: 599px) {
  .lightbox__nav {
    display: none;
  }
}
</style>
