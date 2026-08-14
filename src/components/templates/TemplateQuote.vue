<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { tripView } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/**
 * QUOTE — the title centred on a floating frosted panel over the photo,
 * mirroring the "Qual o seu próximo destino?" poster in the reference.
 */
export default defineComponent({
  name: 'TemplateQuote',

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
  <div class="quote">
    <TripPhoto
      v-if="view.cover"
      :photo="view.cover"
      size="thumb"
      :eager="eager"
      fill
      :rounded="false"
      class="quote__photo"
    />
    <div v-else class="quote__placeholder" />

    <div class="quote__scrim" />

    <div class="quote__card">
      <p class="font-meta quote__meta">{{ view.dateLabel }}</p>

      <h3 class="font-display quote__title">{{ trip.title }}</h3>

      <p class="quote__place">
        <span v-if="view.flag" aria-hidden="true">{{ view.flag }}</span>
        {{ view.placeLabel }}
      </p>

      <span class="quote__cta font-meta">View details</span>
    </div>
  </div>
</template>

<style scoped>
.quote {
  position: relative;
  height: 100%;
  min-height: 320px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: rgb(var(--v-theme-surface-bright));
  display: grid;
  place-items: center;
}

/* Photo and scrim and card all stack in the single grid cell. */
.quote__photo,
.quote__placeholder,
.quote__scrim,
.quote__card {
  grid-area: 1 / 1;
}

.quote__placeholder {
  width: 100%;
  height: 100%;
}

.quote__scrim {
  background: linear-gradient(to bottom, rgba(9, 38, 50, 0.15), rgba(9, 38, 50, 0.4));
}

.quote__card {
  position: relative;
  z-index: 1;
  margin: 1.5rem;
  padding: 1.75rem 1.5rem;
  text-align: center;
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 32px rgba(9, 38, 50, 0.16);
}

.quote__meta {
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.6rem;
}

.quote__title {
  font-size: 1.6rem;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.5rem;
}

.quote__place {
  font-size: 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.quote__cta {
  display: inline-block;
  margin-top: 1.25rem;
  padding: 0.55rem 1.4rem;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  transition: background 0.25s ease;
}

.trip-card:hover .quote__cta {
  background: rgb(var(--v-theme-accent));
}
</style>
