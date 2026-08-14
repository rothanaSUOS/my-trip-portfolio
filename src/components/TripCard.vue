<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TemplateCollage from '@/components/templates/TemplateCollage.vue'
import TemplateFrame from '@/components/templates/TemplateFrame.vue'
import TemplatePanel from '@/components/templates/TemplatePanel.vue'
import TemplateQuote from '@/components/templates/TemplateQuote.vue'
import TemplateWindow from '@/components/templates/TemplateWindow.vue'
import { DEFAULT_TEMPLATE } from '@/data/templates'
import type { Trip, TripTemplate } from '@/types/trip'

/** Template id → the component that renders it. */
const TEMPLATE_COMPONENTS: Record<TripTemplate, string> = {
  panel: 'TemplatePanel',
  window: 'TemplateWindow',
  frame: 'TemplateFrame',
  collage: 'TemplateCollage',
  quote: 'TemplateQuote',
}

/**
 * A trip on the timeline.
 *
 * This component owns the shell — click/keyboard handling, hover motion, the
 * edit and delete buttons — and delegates the actual layout to whichever
 * template the trip selected. Templates are purely presentational: they never
 * handle events, which is why every one of them opens the detail dialog without
 * having to wire anything up.
 */
export default defineComponent({
  name: 'TripCard',

  components: {
    TemplateCollage,
    TemplateFrame,
    TemplatePanel,
    TemplateQuote,
    TemplateWindow,
  },

  props: {
    trip: { type: Object as PropType<Trip>, required: true },
    /** Cards above the fold load their cover eagerly to avoid a blank first paint. */
    eager: { type: Boolean, default: false },
    /** Show the edit/delete overlay. Off when the editor is disabled. */
    editable: { type: Boolean, default: false },
  },

  emits: {
    open: (trip: Trip) => Boolean(trip),
    edit: (trip: Trip) => Boolean(trip),
    remove: (trip: Trip) => Boolean(trip),
  },

  computed: {
    templateComponent(): string {
      return TEMPLATE_COMPONENTS[this.trip.template ?? DEFAULT_TEMPLATE]
    },

    ariaLabel(): string {
      return `View details: ${this.trip.title}, ${this.trip.location.name}`
    },
  },

  methods: {
    open() {
      this.$emit('open', this.trip)
    },
  },
})
</script>

<template>
  <div class="trip-card">
    <!-- The whole card is the "view details" control. -->
    <div
      class="trip-card__surface"
      role="button"
      tabindex="0"
      :aria-label="ariaLabel"
      @click="open"
      @keydown.enter.prevent="open"
      @keydown.space.prevent="open"
    >
      <component :is="templateComponent" :trip="trip" :eager="eager" />
    </div>

    <div v-if="editable" class="trip-card__tools">
      <v-btn
        icon="$pencil"
        size="x-small"
        variant="flat"
        color="surface"
        :aria-label="`Edit ${trip.title}`"
        @click.stop="$emit('edit', trip)"
      />
      <v-btn
        icon="$trash"
        size="x-small"
        variant="flat"
        color="surface"
        :aria-label="`Delete ${trip.title}`"
        @click.stop="$emit('remove', trip)"
      />
    </div>
  </div>
</template>

<style scoped>
.trip-card {
  position: relative;
  height: 100%;
}

.trip-card__surface {
  height: 100%;
  cursor: pointer;
  border-radius: var(--radius-lg);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.35s ease;
  box-shadow: 0 2px 10px rgba(23, 56, 69, 0.05);
}

.trip-card__surface:hover,
.trip-card__surface:focus-visible {
  transform: translateY(-4px);
  box-shadow: 0 18px 36px rgba(23, 56, 69, 0.13);
}

/* Zoom the photo on hover, clipped by each template's own overflow: hidden. */
.trip-card__surface:hover :deep(.trip-photo__img) {
  transform: scale(1.05);
}

.trip-card__tools {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  display: flex;
  gap: 0.35rem;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.trip-card:hover .trip-card__tools,
.trip-card:focus-within .trip-card__tools {
  opacity: 1;
}

/* Touch devices have no hover, so the tools stay visible there. */
@media (hover: none) {
  .trip-card__tools {
    opacity: 1;
  }
}
</style>
