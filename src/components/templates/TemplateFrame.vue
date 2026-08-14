<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/**
 * FRAME — photo mounted in a white-bordered frame on a deep blue card.
 * Suits portrait shots, which would crop badly full-bleed.
 */
export default defineComponent({
  name: 'TemplateFrame',

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
  <div class="frame">
    <div class="frame__mount">
      <TripPhoto
        v-if="view.cover"
        :photo="view.cover"
        size="thumb"
        :eager="eager"
        fill
      />
    </div>

    <div class="frame__body">
      <p class="font-meta frame__meta">
        {{ view.dateLabel }}
        <template v-if="view.durationLabel"> · {{ view.durationLabel }}</template>
      </p>

      <h3 class="font-display frame__title">{{ trip.title }}</h3>

      <p class="frame__place">
        <v-icon icon="$mapMarker" size="15" />
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <span class="frame__cta font-meta">
        View details<v-icon icon="$next" size="16" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.frame {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgb(var(--v-theme-deep));
  color: rgb(var(--v-theme-on-deep));
  border-radius: var(--radius-lg);
  padding: 1.1rem;
}

/* The white "device" mount the photo sits in. */
.frame__mount {
  display: flex;
  flex: 1 1 auto;
  min-height: 120px;
  background: #fff;
  border-radius: var(--radius-md);
  padding: 0.55rem;
}

.frame__mount :deep(.trip-photo) {
  flex: 1 1 auto;
  border-radius: var(--radius-sm);
}

.frame__body {
  flex: 0 0 auto;
  padding: 1.15rem 0.4rem 0.35rem;
}

.frame__meta {
  opacity: 0.8;
  margin-bottom: 0.5rem;
}

.frame__title {
  font-size: 1.45rem;
  margin-bottom: 0.4rem;
}

.frame__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  opacity: 0.85;
}

.frame__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 1.1rem;
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  background: #fff;
  color: rgb(var(--v-theme-primary));
  transition: transform 0.25s ease;
}

.trip-card:hover .frame__cta {
  transform: translateX(3px);
}
</style>
