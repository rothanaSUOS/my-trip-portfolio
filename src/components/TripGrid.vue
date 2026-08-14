<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripCard from '@/components/TripCard.vue'
import type { Trip } from '@/types/trip'

/**
 * The trip listing: a dense, responsive grid of poster cards, newest first.
 *
 * Pinterest-style masonry via CSS multi-column: cards keep their natural height
 * and pack tightly, with no dead space padding a short card out to match a tall
 * one. Column count steps with the breakpoints.
 *
 * Columns rather than CSS grid because grid cannot do true masonry — a card can
 * never rise into the gap left by a shorter neighbour above, so gaps remain.
 * `grid-template-rows: masonry` would solve it but is not shipping broadly yet.
 *
 * The tradeoff is reading order: columns fill top-to-bottom, so the newest trips
 * fill the left column before the middle one, newspaper-style, rather than
 * running left-to-right. For a date-sorted list that stays coherent.
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
  /* Mobile-first: a single column. */
  columns: 1;
  column-gap: 1.25rem;
  padding-block: 1.5rem 4rem;
}

/* ── Cells ──────────────────────────────────────────────────────────────── */

.grid__cell {
  /* Keeps a card from being split across a column boundary. */
  break-inside: avoid;
  /* Column layout has no row-gap, so the spacing lives on the cell. */
  margin-bottom: 1.25rem;
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

.grid__empty {
  /* Spans the whole area rather than sitting in one column. */
  column-span: all;
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
    columns: 2;
    column-gap: 1.5rem;
  }

  .grid__cell {
    margin-bottom: 1.5rem;
  }
}

@media (min-width: 960px) {
  .grid {
    columns: 3;
  }
}
</style>
