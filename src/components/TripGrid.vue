<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripCard from '@/components/TripCard.vue'
import { cardMediaRatio } from '@/utils/tripView'
import type { Trip } from '@/types/trip'

/** Breakpoint → column count. Matches the CSS elsewhere in the app. */
function columnsFor(width: number): number {
  if (width >= 960) return 3
  return width >= 600 ? 2 : 1
}

/**
 * The trip listing: a dense, responsive grid of poster cards, newest first.
 *
 * Pinterest-style masonry: cards keep their natural height and pack tightly,
 * with no dead space padding a short card out to match a tall one.
 *
 * Trips are dealt into columns in date order, each going to whichever column is
 * currently shortest. That keeps reading order left-to-right along each row —
 * newest first — which is the point of a chronological list.
 *
 * CSS multi-column would be less code but fills each column top-to-bottom
 * before starting the next, so nine trips would read 1,4,7 across the top row.
 * CSS grid cannot do real masonry either: a card can never rise into the gap
 * left by a shorter neighbour. `grid-template-rows: masonry` will solve this
 * one day but is not shipping broadly yet.
 *
 * Heights are *estimated* from each photo's recorded aspect ratio rather than
 * measured, so the columns are decided before anything renders — no reflow, and
 * no flash of a wrong layout.
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
      columnCount: 1,
    }
  },

  computed: {
    /**
     * Trips dealt into columns, in order, each to the shortest column so far.
     *
     * The classic greedy masonry fill. Order is preserved because trips are
     * placed in sequence, so the first card is always top-left.
     */
    columns(): Trip[][] {
      const buckets = Array.from({ length: this.columnCount }, () => ({
        height: 0,
        trips: [] as Trip[],
      }))

      for (const trip of this.trips) {
        let shortest = buckets[0]!
        for (const bucket of buckets) {
          if (bucket.height < shortest.height) shortest = bucket
        }

        shortest.trips.push(trip)
        shortest.height += this.estimateHeight(trip)
      }

      return buckets.map((bucket) => bucket.trips)
    },

    /** trip id → its position overall, for the stagger and eager-loading. */
    orderById(): Map<string, number> {
      return new Map(this.trips.map((trip, index) => [trip.id, index]))
    },
  },

  watch: {
    // Filtering swaps the rendered cards, so re-observe after Vue patches the DOM.
    trips() {
      this.$nextTick(() => this.observeCards())
    },
  },

  mounted() {
    this.updateColumnCount()
    window.addEventListener('resize', this.updateColumnCount, { passive: true })

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
    window.removeEventListener('resize', this.updateColumnCount)
    this.observer?.disconnect()
    this.observer = null
  },

  methods: {
    isRevealed(trip: Trip): boolean {
      return this.revealed.has(trip.id)
    },

    updateColumnCount() {
      const next = columnsFor(window.innerWidth)
      if (next === this.columnCount) return

      this.columnCount = next
      // Different column split means different cards; re-observe after patching.
      this.$nextTick(() => this.observeCards())
    },

    /**
     * Roughly how tall a card will be, in multiples of the column width.
     *
     * Only used to compare columns against each other, so it needs to be
     * proportionate rather than exact — the media area dominates, and the body
     * is near-constant apart from how many lines the title wraps to.
     */
    estimateHeight(trip: Trip): number {
      const media = 1 / cardMediaRatio(trip)
      const titleLines = Math.max(1, Math.ceil(trip.title.length / 24))

      return media + 0.4 + titleLines * 0.1
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
    <div v-for="(column, columnIndex) in columns" :key="columnIndex" class="grid__column">
      <div
        v-for="trip in column"
        :key="trip.id"
        :data-trip-id="trip.id"
        class="grid__cell"
        :class="{ 'is-revealed': isRevealed(trip) }"
        :style="{ '--reveal-delay': `${((orderById.get(trip.id) ?? 0) % 3) * 70}ms` }"
      >
        <TripCard
          :trip="trip"
          :eager="(orderById.get(trip.id) ?? 0) < 3"
          :editable="editable"
          @open="$emit('open', $event)"
          @edit="$emit('edit', $event)"
          @remove="$emit('remove', $event)"
        />
      </div>
    </div>

    <p v-if="!trips.length" class="grid__empty font-meta">
      <v-icon icon="$mapSearch" size="32" />
      No trips match these filters.
    </p>
  </div>
</template>

<style scoped>
.grid {
  display: flex;
  gap: 1.25rem;
  /* Columns are independent stacks — they must not stretch to match each other. */
  align-items: flex-start;
  padding-block: 1.5rem 4rem;
}

.grid__column {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Cells ──────────────────────────────────────────────────────────────── */

.grid__cell {
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
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 5rem 1rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

/* ── Breakpoints ────────────────────────────────────────────────────────── */

/* Column *count* is decided in JavaScript, since the masonry fill needs to know
   it; these only widen the gaps. Keep the breakpoints in step with columnsFor(). */
@media (min-width: 600px) {
  .grid,
  .grid__column {
    gap: 1.5rem;
  }
}
</style>
