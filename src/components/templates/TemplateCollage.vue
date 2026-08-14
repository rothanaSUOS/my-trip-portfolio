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

    /**
     * Stack the pair instead of splitting them side by side when both are
     * landscape, which is what Facebook does.
     *
     * Two landscape photos in side-by-side tiles end up in ~0.65 boxes and lose
     * most of their width; stacked, each tile is roughly 4:3 and barely crops.
     * A portrait pair is the other way round, so it stays side by side.
     *
     * Needs the recorded dimensions — without them the orientation is unknown
     * until the image loads, so it falls back to side by side.
     */
    stacked(): boolean {
      if (!this.hasPair) return false

      return this.trip.photos
        .slice(0, 2)
        .every((photo) => Boolean(photo.width && photo.height) && photo.width! / photo.height! > 1.2)
    },
  },
})
</script>

<template>
  <div class="collage">
    <div
      class="collage__media"
      :class="{ 'collage__media--single': !hasPair, 'collage__media--stacked': stacked }"
    >
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

/* A landscape pair, stacked. 2:3 overall makes each of the two rows ~4:3. */
.collage__media--stacked {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr 1fr;
  aspect-ratio: 2 / 3;
}

.collage__media :deep(.trip-photo) {
  border-radius: var(--radius-md);
}

/* Offset the second photo downward so a side-by-side pair reads as a collage
   rather than a two-column grid. Stacked pairs sit flush. */
.collage__b {
  margin-top: 1.75rem;
}

.collage__media--stacked .collage__b {
  margin-top: 0;
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
