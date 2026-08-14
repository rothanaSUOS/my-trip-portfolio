<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripCard from '@/components/TripCard.vue'
import type { Trip } from '@/types/trip'

/**
 * The trip listing: a dense, responsive grid of poster cards, newest first.
 *
 * Every tile is the same size. `grid-auto-rows: 1fr` gives all rows one track
 * height and the cards stretch to fill it; each template then absorbs the slack
 * in its photo area. Letting cards keep their natural heights instead produced a
 * ragged waterfall, which is not the look.
 *
 * There are deliberately no year dividers. Most years hold a single trip, and a
 * full-width heading per trip stretched the grid into one tall column — the
 * opposite of the dense collage this is meant to be. Every card already prints
 * its own full date, and the filter bar handles narrowing by period.
 */
export default defineComponent({
  name: 'TripGrid',

  components: { TripCard },

  props: {
    /** Already filtered and sorted newest-first by the parent. */
    trips: { type: Array as PropType<Trip[]>, required: true },
    /** Show each card's edit/delete controls. */
    editable: { type: Boolean, default: false },
  },

  emits: {
    open: (trip: Trip) => Boolean(trip),
    edit: (trip: Trip) => Boolean(trip),
    remove: (trip: Trip) => Boolean(trip),
  },

  data() {
    return {
      /** Ids of cards that have scrolled into view, for the fade-in. */
      revealed: new Set<string>(),
      observer: null as IntersectionObserver | null,
    }
  },

  watch: {
    // Filtering swaps the rendered cards, so re-observe after Vue patches the DOM.
    trips() {
      this.$nextTick(() => this.observeCards())
    },
  },

  mounted() {
    // Without IntersectionObserver support, reveal everything immediately.
    if (!('IntersectionObserver' in window)) {
      this.revealed = new Set(this.trips.map((trip) => trip.id))
      return
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.tripId
          if (entry.isIntersecting && id) {
            this.revealed.add(id)
            // Reveal is one-way — stop watching so scrolling back up is free.
            this.observer?.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -5% 0px', threshold: 0.02 },
    )

    this.observeCards()
  },

  beforeUnmount() {
    this.observer?.disconnect()
    this.observer = null
  },

  methods: {
    isRevealed(trip: Trip): boolean {
      return this.revealed.has(trip.id)
    },

    /**
     * Queries the DOM rather than reading `this.$refs`: the cards sit inside a
     * v-for nested in another v-for, where the ref array does not reliably
     * collect every item across both levels.
     */
    observeCards() {
      if (!this.observer) return

      const cards = (this.$el as HTMLElement).querySelectorAll('[data-trip-id]')
      cards.forEach((card) => {
        const id = (card as HTMLElement).dataset.tripId
        if (id && !this.revealed.has(id)) this.observer?.observe(card)
      })
    },
  },
})
</script>

<template>
  <div class="grid">
    <div
      v-for="(trip, index) in trips"
      :key="trip.id"
      :data-trip-id="trip.id"
      class="grid__cell"
      :class="{ 'is-revealed': isRevealed(trip) }"
      :style="{ '--reveal-delay': `${(index % 3) * 70}ms` }"
    >
      <TripCard
        :trip="trip"
        :eager="index < 3"
        :editable="editable"
        @open="$emit('open', $event)"
        @edit="$emit('edit', $event)"
        @remove="$emit('remove', $event)"
      />
    </div>

    <p v-if="!trips.length" class="grid__empty font-meta">
      <v-icon icon="$mapSearch" size="32" />
      No trips match these filters.
    </p>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  /* Mobile-first: a single column. */
  grid-template-columns: 1fr;
  gap: 1.25rem;
  /* Every tile the same height: rows share one track size and cards stretch to
     fill it. Templates absorb the slack in their photo area, so the grid reads
     as an even set of posters rather than a ragged waterfall. */
  grid-auto-rows: 1fr;
  align-items: stretch;
  padding-block: 1.5rem 4rem;
}

/* ── Cells ──────────────────────────────────────────────────────────────── */

.grid__cell {
  min-width: 0;
  /* Cells stretch, so the card inside can be height: 100%. */
  display: flex;
  opacity: 0;
  transform: translateY(22px);
  transition:
    opacity 0.55s ease var(--reveal-delay, 0ms),
    transform 0.55s cubic-bezier(0.4, 0, 0.2, 1) var(--reveal-delay, 0ms);
}

.grid__cell.is-revealed {
  opacity: 1;
  transform: none;
}

.grid__cell > * {
  flex: 1 1 auto;
  min-width: 0;
}

.grid__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 5rem 1rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ── Breakpoints ────────────────────────────────────────────────────────── */

@media (min-width: 600px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
  }
}

@media (min-width: 960px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
