<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Photo, Trip } from '@/types/trip'

/**
 * GRID — four photos in an even 2×2, Facebook's 4-up shape.
 *
 * With three it uses Facebook's other arrangement: one wide across the top and
 * two beneath. With two it splits down the middle, with one it fills the frame.
 * Anything beyond four is counted into a "+N" badge on the last tile rather
 * than shrinking the tiles further — past four, photos stop being legible at
 * card size.
 */
export default defineComponent({
  name: 'TemplateGrid',

  components: { TripPhoto },

  props: {
    trip: { type: Object as PropType<Trip>, required: true },
    eager: { type: Boolean, default: false },
  },

  computed: {
    view() {
      return tripView(this.trip)
    },

    shown(): Photo[] {
      return this.trip.photos.slice(0, 4)
    },

    overflow(): number {
      return Math.max(0, this.trip.photos.length - this.shown.length)
    },
  },
})
</script>

<template>
  <div class="pgrid">
    <div class="pgrid__media" :class="`pgrid__media--${shown.length}`">
      <div
        v-for="(photo, index) in shown"
        :key="photo.id"
        class="pgrid__tile"
        :class="`pgrid__tile--${index}`"
      >
        <TripPhoto :photo="photo" size="thumb" :eager="eager && index === 0" fill :rounded="false" />
        <span v-if="overflow && index === shown.length - 1" class="pgrid__more font-display">
          +{{ overflow }}
        </span>
      </div>
    </div>

    <div class="pgrid__body">
      <p class="font-meta pgrid__meta">
        <v-icon :icon="view.chapter.icon" size="14" :color="view.chapter.color" />
        {{ view.dateLabel }}
        <template v-if="view.photoCount > 1"> · {{ view.photoCount }} photos</template>
      </p>

      <h3 class="font-display pgrid__title">{{ trip.title }}</h3>

      <p class="pgrid__place">
        <v-icon icon="$mapMarker" size="15" />
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <span class="pgrid__cta font-meta">
        View details<v-icon icon="$next" size="16" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.pgrid {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.75rem 0;
  overflow: hidden;
}

.pgrid__media {
  display: grid;
  gap: 3px;
  /* Fixed 4:3 so landscape photos are not squeezed into vertical strips. */
  flex: 0 0 auto;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pgrid__media--1 {
  grid-template-columns: 1fr;
}

.pgrid__media--2 {
  grid-template-columns: 1fr 1fr;
}

/* Three: one wide across the top, two beneath. */
.pgrid__media--3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1.35fr 1fr;
}

.pgrid__media--3 .pgrid__tile--0 {
  grid-column: 1 / 3;
}

/* Four: an even 2×2. */
.pgrid__media--4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.pgrid__tile {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.pgrid__more {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(9, 38, 50, 0.55);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 300;
  backdrop-filter: blur(2px);
}

.pgrid__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.15rem 0.6rem 1.4rem;
}

.pgrid__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.5rem;
}

.pgrid__title {
  font-size: 1.4rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.35rem;
}

.pgrid__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.pgrid__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: auto;
  padding: 0.5rem 1.1rem;
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 999px;
  color: rgb(var(--v-theme-primary));
  transition: background 0.25s ease, border-color 0.25s ease;
}

.trip-card:hover .pgrid__cta {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
