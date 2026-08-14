<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/**
 * PANEL — white card, photo inset in a rounded frame, story below.
 * The default layout: calm, readable, and safe for any photo shape.
 */
export default defineComponent({
  name: 'TemplatePanel',

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
  <div class="panel">
    <div v-if="view.cover" class="panel__media">
      <TripPhoto :photo="view.cover" size="thumb" :eager="eager" fill />
      <span v-if="view.photoCount > 1" class="panel__count font-meta">
        <v-icon icon="$imageMultiple" size="13" />
        {{ view.photoCount }}
      </span>
    </div>

    <div class="panel__body">
      <p class="font-meta panel__meta">
        <v-icon :icon="view.chapter.icon" size="14" :color="view.chapter.color" />
        {{ view.dateLabel }}
        <template v-if="view.durationLabel"> · {{ view.durationLabel }}</template>
      </p>

      <h3 class="font-display panel__title">{{ trip.title }}</h3>

      <p class="panel__place">
        <v-icon icon="$mapMarker" size="15" />
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <p class="panel__teaser">{{ view.teaser }}</p>

      <span class="panel__cta font-meta">
        View details<v-icon icon="$next" size="16" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel__media {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  /* min-height lets the photo shrink below its intrinsic size in a short cell. */
  min-height: 120px;
  padding: 0.75rem 0.75rem 0;
}

.panel__media :deep(.trip-photo) {
  flex: 1 1 auto;
  border-radius: var(--radius-md);
}

.panel__count {
  position: absolute;
  right: 1.4rem;
  bottom: 0.65rem;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: rgb(var(--v-theme-primary));
}

.panel__body {
  flex: 0 0 auto;
  padding: 1.15rem 1.35rem 1.5rem;
}

.panel__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.6rem;
}

.panel__title {
  font-size: 1.45rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.4rem;
}

.panel__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 0.7rem;
}

.panel__teaser {
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgb(var(--v-theme-on-surface-variant));
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.panel__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 1rem;
  padding: 0.5rem 1.1rem;
  border: 1px solid rgb(var(--v-theme-surface-variant));
  border-radius: 999px;
  color: rgb(var(--v-theme-primary));
  transition: background 0.25s ease, border-color 0.25s ease;
}

.trip-card:hover .panel__cta {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
}
</style>
