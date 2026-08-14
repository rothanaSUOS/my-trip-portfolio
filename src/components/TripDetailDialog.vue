<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TripPhoto from '@/components/TripPhoto.vue'
import { chapterMeta } from '@/data/chapters'
import { formatTripRange, tripDuration } from '@/utils/date'
import { formatStory } from '@/utils/text'
import type { Trip } from '@/types/trip'

/**
 * Full detail for one trip: hero photo, story, highlights and a photo grid.
 * Selecting a photo bubbles up as `view-photo` so App.vue can open the lightbox.
 */
export default defineComponent({
  name: 'TripDetailDialog',

  components: { TripPhoto },

  props: {
    modelValue: { type: Boolean, default: false },
    /** `null` while closed, so the dialog renders nothing between openings. */
    trip: { type: Object as PropType<Trip | null>, default: null },
    /** Show the "Edit trip" action. */
    editable: { type: Boolean, default: false },
  },

  emits: {
    'update:modelValue': (value: boolean) => typeof value === 'boolean',
    'view-photo': (index: number) => Number.isInteger(index),
    edit: () => true,
  },

  computed: {
    chapter() {
      return this.trip ? chapterMeta(this.trip.chapter) : null
    },

    dateLabel(): string {
      if (!this.trip) return ''
      return formatTripRange(this.trip.date, this.trip.endDate)
    },

    durationLabel(): string {
      if (!this.trip) return ''
      const nights = tripDuration(this.trip.date, this.trip.endDate)
      if (!nights) return ''
      return nights === 1 ? '1 night' : `${nights} nights`
    },

    /** Editor line wraps collapsed; blank lines kept as paragraph breaks. */
    story(): string {
      return this.trip ? formatStory(this.trip.description) : ''
    },

    hero() {
      return this.trip?.photos[0]
    },

    /** Photos after the hero — the grid below the story. */
    restPhotos() {
      return this.trip?.photos.slice(1) ?? []
    },
  },

  methods: {
    close() {
      this.$emit('update:modelValue', false)
    },
  },
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="880"
    :fullscreen="$vuetify.display.smAndDown"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card v-if="trip" class="detail" rounded="0">
      <div class="detail__hero">
        <TripPhoto
          v-if="hero"
          :photo="hero"
          size="grid"
          :aspect-ratio="16 / 9"
          :rounded="false"
          eager
          class="detail__hero-photo"
          @click="$emit('view-photo', 0)"
        />

        <div class="detail__hero-tools">
          <v-btn
            v-if="editable"
            icon="$pencil"
            size="small"
            color="surface"
            aria-label="Edit this trip"
            @click="$emit('edit')"
          />
          <v-btn
            icon="$close"
            size="small"
            color="surface"
            aria-label="Close trip"
            @click="close"
          />
        </div>
      </div>

      <v-card-text class="detail__body">
        <p class="font-meta detail__meta">
          <v-icon v-if="chapter" :icon="chapter.icon" size="14" :color="chapter.color" />
          {{ chapter?.label }} · {{ dateLabel }}
          <template v-if="durationLabel"> · {{ durationLabel }}</template>
        </p>

        <h2 class="font-display detail__title">{{ trip.title }}</h2>

        <p class="detail__place">
          <v-icon icon="$mapMarker" size="16" />
          {{ trip.location.name }}, {{ trip.location.country }}
        </p>

        <p class="prose detail__story">{{ story }}</p>

        <template v-if="trip.highlights?.length">
          <h3 class="font-meta detail__section">Highlights</h3>
          <ul class="detail__highlights">
            <li v-for="highlight in trip.highlights" :key="highlight">
              <v-icon icon="$circleSmall" size="18" color="accent" />
              {{ highlight }}
            </li>
          </ul>
        </template>

        <template v-if="restPhotos.length">
          <h3 class="font-meta detail__section">Photos</h3>
          <div class="detail__grid">
            <button
              v-for="(photo, i) in restPhotos"
              :key="photo.id"
              type="button"
              class="detail__grid-item"
              :aria-label="`View photo: ${photo.alt}`"
              @click="$emit('view-photo', i + 1)"
            >
              <TripPhoto :photo="photo" size="grid" :aspect-ratio="1" />
            </button>
          </div>
        </template>

        <div v-if="trip.tags?.length" class="detail__tags">
          <v-chip v-for="tag in trip.tags" :key="tag" size="small" variant="outlined">
            {{ tag }}
          </v-chip>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.detail {
  background: rgb(var(--v-theme-surface));
}

.detail__hero {
  position: relative;
}

.detail__hero-photo {
  cursor: zoom-in;
}

.detail__hero-tools {
  position: absolute;
  top: 0.85rem;
  right: 0.85rem;
  display: flex;
  gap: 0.4rem;
}

.detail__body {
  padding: 1.5rem 1.75rem 2rem;
}

.detail__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.5rem;
}

.detail__title {
  font-size: 2.25rem;
  line-height: 1.15;
  color: rgb(var(--v-theme-primary));
  margin-bottom: 0.5rem;
}

.detail__place {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 1.5rem;
}

.detail__story {
  font-size: 1rem;
}

.detail__section {
  margin: 2rem 0 0.85rem;
  color: rgb(var(--v-theme-on-surface-variant));
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
  padding-bottom: 0.4rem;
}

.detail__highlights {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.95rem;
}

.detail__highlights li {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.6rem;
}

.detail__grid-item {
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  border-radius: 6px;
  overflow: hidden;
  transition: opacity 0.25s ease;
}

.detail__grid-item:hover {
  opacity: 0.82;
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 2rem;
}

@media (max-width: 599px) {
  .detail__body {
    padding: 1.25rem 1.1rem 2.5rem;
  }

  .detail__title {
    font-size: 1.75rem;
  }

  .detail__grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }
}
</style>
