<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/**
 * COLLAGE — two photos side by side, offset in height, story below.
 *
 * Needs two photos. With only one it falls back to a single wide frame rather
 * than rendering an empty box, so picking this template on a one-photo trip
 * degrades gracefully instead of looking broken.
 */
export default defineComponent({
  name: 'TemplateCollage',

  components: { TripPhoto },

  props: {
    trip: { type: Object as PropType<Trip>, required: true },
    eager: { type: Boolean, default: false },
  },

  computed: {
    view() {
      return tripView(this.trip)
    },

    hasPair(): boolean {
      return Boolean(this.view.cover && this.view.second)
    },
  },
})
</script>

<template>
  <div class="collage">
    <div class="collage__media" :class="{ 'collage__media--single': !hasPair }">
      <TripPhoto
        v-if="view.cover"
        :photo="view.cover"
        size="thumb"
        :eager="eager"
        fill
        class="collage__a"
      />
      <TripPhoto
        v-if="view.second"
        :photo="view.second"
        size="thumb"
        fill
        class="collage__b"
      />
    </div>

    <div class="collage__body">
      <p class="font-meta collage__meta">
        <v-icon :icon="view.chapter.icon" size="14" :color="view.chapter.color" />
        {{ view.dateLabel }}
      </p>

      <h3 class="font-display collage__title">{{ trip.title }}</h3>

      <p class="collage__place">
        <v-icon icon="$mapMarker" size="15" />
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <p class="collage__teaser">{{ view.teaser }}</p>

      <span class="collage__cta font-meta">
        View details<v-icon icon="$next" size="16" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.collage {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-lg);
  padding: 0.75rem 0.75rem 0;
  overflow: hidden;
}

.collage__media {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  /* Fixed 4:3 so landscape photos are not squeezed into vertical strips. */
  flex: 0 0 auto;
  aspect-ratio: 4 / 3;
}

.collage__media--single {
  grid-template-columns: 1fr;
}

.collage__media :deep(.trip-photo) {
  border-radius: var(--radius-md);
}

/* Offset the second photo downward so the pair reads as a collage rather than
   a two-column grid. */
.collage__b {
  margin-top: 1.75rem;
}

.collage__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1.25rem 0.6rem 1.5rem;
}

.collage__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.5rem;
}

.collage__title {
  font-size: 1.45rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.4rem;
}

.collage__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 0.7rem;
}

.collage__teaser {
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgb(var(--v-theme-on-surface-variant));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collage__cta {
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

.trip-card:hover .collage__cta {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
