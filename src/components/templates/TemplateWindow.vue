<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/**
 * WINDOW — full-bleed photo with the title set over it in white.
 * Wants one strong wide shot; text sits on a gradient scrim so it stays legible
 * over a bright sky.
 */
export default defineComponent({
  name: 'TemplateWindow',

  components: { TripPhoto },

  props: {
    trip: { type: Object as PropType<Trip>, required: true },
    eager: { type: Boolean, default: false },
  },

  computed: {
    view() {
      return tripView(this.trip)
    },
  },
})
</script>

<template>
  <div class="window">
    <TripPhoto
      v-if="view.cover"
      :photo="view.cover"
      size="thumb"
      :eager="eager"
      :aspect-ratio="0"
      :rounded="false"
      class="window__photo"
    />
    <div v-else class="window__placeholder" />

    <div class="window__overlay">
      <p class="font-meta window__meta">
        {{ view.dateLabel }}
        <template v-if="view.flag"> · <span aria-hidden="true">{{ view.flag }}</span></template>
      </p>

      <h3 class="font-display window__title">{{ trip.title }}</h3>

      <p class="window__place">
        <v-icon icon="$mapMarker" size="15" />
        {{ view.placeLabel }}
      </p>

      <span class="window__cta font-meta">
        View details<v-icon icon="$next" size="15" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.window {
  position: relative;
  /* Intrinsic height from the photo: in a masonry column there is no cell
     height to fill, so height: 100% would collapse to nothing. */
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgb(var(--v-theme-surface-bright));
}

.window__placeholder {
  aspect-ratio: 4 / 5;
}

/* Scrim: transparent over the top two-thirds so the photo reads, deepening
   under the text block. */
.window__overlay {
  position: absolute;
  inset: auto 0 0 0;
  padding: 4rem 1.5rem 1.5rem;
  color: #fff;
  /* Holds near-solid across the whole text block and fades only through the top
     padding. Fading gradually from the overlay's bottom leaves the date line
     sitting at ~0.5 alpha, which disappears against a bright sky. */
  background: linear-gradient(
    to top,
    rgba(9, 38, 50, 0.95) 0%,
    rgba(9, 38, 50, 0.9) 70%,
    rgba(9, 38, 50, 0) 100%
  );
}

.window__meta {
  opacity: 0.85;
  margin-bottom: 0.5rem;
}

.window__title {
  font-size: 1.75rem;
  margin-bottom: 0.4rem;
}

.window__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  opacity: 0.85;
}

.window__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 1.1rem;
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  transition: background 0.25s ease;
}

.trip-card:hover .window__cta {
  background: rgba(255, 255, 255, 0.3);
}
</style>
