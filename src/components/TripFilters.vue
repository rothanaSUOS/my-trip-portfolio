<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import { CHAPTERS } from '@/data/chapters'
import type { LifeChapter } from '@/types/trip'

/**
 * Search box, chapter chips and country select.
 *
 * Fully controlled: it renders the `search` / `chapters` / `country` props and
 * emits updates. All filtering logic lives in App.vue so a single source of
 * truth decides what the timeline shows.
 */
export default defineComponent({
  name: 'TripFilters',

  props: {
    search: { type: String, default: '' },
    /** Empty array means "all chapters". */
    chapters: { type: Array as PropType<LifeChapter[]>, default: () => [] },
    /** `null` means "all countries". */
    country: { type: String as PropType<string | null>, default: null },
    /** Country names present in the data, for the select. */
    countries: { type: Array as PropType<string[]>, required: true },
    /** How many trips survive the current filters — shown as a live count. */
    resultCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
  },

  emits: {
    'update:search': (value: string) => typeof value === 'string',
    'update:chapters': (value: LifeChapter[]) => Array.isArray(value),
    'update:country': (value: string | null) => value === null || typeof value === 'string',
    reset: () => true,
  },

  data() {
    return {
      allChapters: CHAPTERS,
    }
  },

  computed: {
    isFiltered(): boolean {
      return Boolean(this.search) || this.chapters.length > 0 || this.country !== null
    },

    countLabel(): string {
      if (!this.isFiltered) {
        return `${this.totalCount} ${this.totalCount === 1 ? 'trip' : 'trips'}`
      }
      return `${this.resultCount} of ${this.totalCount}`
    },
  },

  methods: {
    isActive(id: LifeChapter): boolean {
      return this.chapters.includes(id)
    },

    /** Chapter chips are a multi-select toggle, not radio buttons. */
    toggleChapter(id: LifeChapter) {
      const next = this.isActive(id)
        ? this.chapters.filter((chapter) => chapter !== id)
        : [...this.chapters, id]
      this.$emit('update:chapters', next)
    },
  },
})
</script>

<template>
  <section class="filters" aria-label="Filter trips">
    <div class="filters__row">
      <v-text-field
        :model-value="search"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        placeholder="Search trips, places, tags…"
        prepend-inner-icon="$magnify"
        class="filters__search"
        @update:model-value="$emit('update:search', $event ?? '')"
      />

      <v-select
        :model-value="country"
        :items="countries"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        placeholder="All countries"
        prepend-inner-icon="$earth"
        class="filters__country"
        @update:model-value="$emit('update:country', $event ?? null)"
      />
    </div>

    <div class="filters__row filters__row--chips">
      <v-chip
        v-for="chapter in allChapters"
        :key="chapter.id"
        :color="isActive(chapter.id) ? chapter.color : undefined"
        :variant="isActive(chapter.id) ? 'flat' : 'outlined'"
        :prepend-icon="chapter.icon"
        :aria-pressed="isActive(chapter.id)"
        role="button"
        @click="toggleChapter(chapter.id)"
      >
        {{ chapter.label }}
      </v-chip>

      <v-spacer />

      <span class="font-meta filters__count" aria-live="polite">{{ countLabel }}</span>

      <v-btn
        v-if="isFiltered"
        size="small"
        prepend-icon="$close"
        class="font-meta"
        @click="$emit('reset')"
      >
        Clear
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.filters__row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.filters__row--chips {
  flex-wrap: wrap;
  gap: 0.5rem;
}

.filters__search {
  flex: 1 1 auto;
}

.filters__country {
  flex: 0 0 220px;
}

.filters__count {
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
}

/* On phones the two inputs stack and the country select goes full width. */
@media (max-width: 599px) {
  .filters__row {
    flex-direction: column;
    align-items: stretch;
  }

  .filters__row--chips {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  .filters__country {
    flex: 1 1 auto;
  }

  /* Let the chip row scroll horizontally instead of wrapping to four lines. */
  .filters__count {
    margin-left: auto;
  }
}
</style>
