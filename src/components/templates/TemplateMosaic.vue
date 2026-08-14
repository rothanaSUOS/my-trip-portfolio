<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Photo, Trip } from '@/types/trip'

/**
 * MOSAIC — three photos, Facebook's 3-up shape: one tall on the left, two
 * stacked on the right.
 *
 * Falls back sensibly below three: with two it splits down the middle, with one
 * it fills the whole frame. The layout is driven by how many photos actually
 * exist rather than by the template's ideal, so choosing this for a one-photo
 * trip still looks deliberate.
 */
export default defineComponent({
  name: 'TemplateMosaic',

  components: { TripPhoto },

  props: {
    trip: { type: Object as PropType<Trip>, required: true },
    eager: { type: Boolean, default: false },
  },

  computed: {
    view() {
      return tripView(this.trip)
    },

    /** At most three; the rest are counted in the badge. */
    shown(): Photo[] {
      return this.trip.photos.slice(0, 3)
    },

    /** Photos this layout cannot show, surfaced as "+N" on the last tile. */
    overflow(): number {
      return Math.max(0, this.trip.photos.length - this.shown.length)
    },
  },
})
</script>

<template>
  <div class="mosaic">
    <div class="mosaic__media" :class="`mosaic__media--${shown.length}`">
      <div
        v-for="(photo, index) in shown"
        :key="photo.id"
        class="mosaic__tile"
        :class="`mosaic__tile--${index}`"
      >
        <TripPhoto :photo="photo" size="thumb" :eager="eager && index === 0" fill :rounded="false" />
        <span v-if="overflow && index === shown.length - 1" class="mosaic__more font-display">
          +{{ overflow }}
        </span>
      </div>
    </div>

    <div class="mosaic__body">
      <p class="font-meta mosaic__meta">
        <v-icon :icon="view.chapter.icon" size="14" :color="view.chapter.color" />
        {{ view.dateLabel }}
      </p>

      <h3 class="font-display mosaic__title">{{ trip.title }}</h3>

      <p class="mosaic__place">
        <v-icon icon="$mapMarker" size="15" />
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <span class="mosaic__cta font-meta">
        View details<v-icon icon="$next" size="16" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.mosaic {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.75rem 0;
  overflow: hidden;
}

/* 3px gaps, like Facebook's album grid — tight enough to read as one image. */
.mosaic__media {
  display: grid;
  gap: 3px;
  /* Fixed 4:3 so landscape photos are not squeezed into vertical strips. */
  flex: 0 0 auto;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* One photo fills the frame. */
.mosaic__media--1 {
  grid-template-columns: 1fr;
}

/* Two split it down the middle. */
.mosaic__media--2 {
  grid-template-columns: 1fr 1fr;
}

/* Three: tall left, two stacked right. */
.mosaic__media--3 {
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.mosaic__media--3 .mosaic__tile--0 {
  grid-row: 1 / 3;
}

.mosaic__tile {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

/* Sits over the last tile when the trip holds more photos than fit. */
.mosaic__more {
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

.mosaic__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.15rem 0.6rem 1.4rem;
}

.mosaic__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.5rem;
}

.mosaic__title {
  font-size: 1.4rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.35rem;
}

.mosaic__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.mosaic__cta {
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

.trip-card:hover .mosaic__cta {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
