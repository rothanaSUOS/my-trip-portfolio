<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import TemplatePicker from '@/components/TemplatePicker.vue'
import TripPhoto from '@/components/TripPhoto.vue'
import { CATEGORIES } from '@/data/categories'
import { CHAPTERS } from '@/data/chapters'
import { DEFAULT_TEMPLATE } from '@/data/templates'
import { formatBytes, photoPath, prepareImage, ImageError } from '@/services/images'
import { isGooglePhotosAlbumLink, isSessionBoundPhotoUrl } from '@/services/photos'
import { isIdTaken } from '@/services/tripStore'
import {
  fromDateObject,
  precisionOf,
  toDateObject,
  withPrecision,
  type DatePrecision,
} from '@/utils/date'
import type { LifeChapter, Photo, Trip, TripCategory, TripTemplate } from '@/types/trip'

/** A photo row that still holds bytes waiting to be committed. */
interface PendingUpload {
  bytes: Uint8Array
  /** Object URL for the local preview, revoked when the row goes away. */
  previewUrl: string
  label: string
}

/** Shape of the form while editing — same as Trip, but every field editable. */
interface TripDraft {
  id: string
  title: string
  date: string
  endDate: string
  locationName: string
  country: string
  countryCode: string
  chapter: LifeChapter
  template: TripTemplate
  description: string
  highlights: string[]
  categories: TripCategory[]
  photos: Photo[]
}

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD` — the three precisions trips support. */
const DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/

function emptyDraft(): TripDraft {
  return {
    id: '',
    title: '',
    date: '',
    endDate: '',
    locationName: '',
    country: '',
    countryCode: '',
    chapter: 'recent',
    template: DEFAULT_TEMPLATE,
    description: '',
    highlights: [],
    categories: [],
    photos: [],
  }
}

/**
 * Create / edit form for a trip, including its template and photos.
 *
 * Edits a local draft and only emits `save` once validation passes, so a
 * half-filled form never reaches the store and closing without saving discards
 * cleanly.
 */
export default defineComponent({
  name: 'TripEditorDialog',

  components: { TemplatePicker, TripPhoto },

  props: {
    modelValue: { type: Boolean, default: false },
    /** Trip being edited, or `null` to create a new one. */
    trip: { type: Object as PropType<Trip | null>, default: null },
    /** Every trip currently loaded, for rejecting duplicate ids. */
    existingTrips: { type: Array as PropType<Trip[]>, default: () => [] },
    /** True while the parent is committing — disables the form. */
    saving: { type: Boolean, default: false },
    /** Error from the last save attempt, shown in the actions bar. */
    saveError: { type: String, default: '' },
  },

  emits: {
    'update:modelValue': (value: boolean) => typeof value === 'boolean',
    /**
     * The finished trip plus any image bytes still to be committed. The parent
     * uploads the photos first, then writes the trip, so a trip is never saved
     * pointing at an image that does not exist yet.
     */
    save: (payload: { trip: Trip; uploads: { path: string; bytes: Uint8Array }[] }) =>
      Boolean(payload.trip),
  },

  data() {
    return {
      draft: emptyDraft(),
      chapters: CHAPTERS,
      allCategories: CATEGORIES,
      /**
       * How precisely this trip's dates are known. The picker always returns a
       * full `Date`; this decides how much of it is kept, so a childhood trip
       * can still be stored as `2004-07` or `2001`.
       */
      datePrecision: 'day' as DatePrecision,
      precisionOptions: [
        { value: 'day', label: 'Exact day' },
        { value: 'month', label: 'Month only' },
        { value: 'year', label: 'Year only' },
      ] as { value: DatePrecision; label: string }[],
      /** Set once the user tries to save, so errors don't shout at an empty form. */
      submitted: false,
      /** Auto-derive the id from title + year until the user overrides it. */
      idTouched: false,
      /**
       * Pending uploads, index-aligned with `draft.photos`. A null slot means
       * that row uses a pasted URL. Kept parallel (rather than keyed by index)
       * so reordering and removal move the bytes with their row.
       */
      uploads: [] as (PendingUpload | null)[],
      uploadError: '',
      preparing: false,
    }
  },

  computed: {
    isEditing(): boolean {
      return this.trip !== null
    },

    /**
     * Bridges VDateInput (which speaks `Date`) and the draft (which stores a
     * possibly-partial string). Writing truncates to the chosen precision.
     */
    startDateModel: {
      get(): Date | null {
        return toDateObject(this.draft.date)
      },
      set(value: Date | null) {
        this.draft.date = fromDateObject(value, this.datePrecision)
      },
    },

    endDateModel: {
      get(): Date | null {
        return toDateObject(this.draft.endDate)
      },
      set(value: Date | null) {
        this.draft.endDate = fromDateObject(value, this.datePrecision)
      },
    },

    /** Hint under the date row, so the stored value is never a surprise. */
    precisionHint(): string {
      if (this.datePrecision === 'year') return 'Stored as the year alone, e.g. 2001.'
      if (this.datePrecision === 'month') return 'Stored as year and month, e.g. 2004-07.'
      return 'Stored as a full date, e.g. 2019-03-28.'
    },

    suggestedId(): string {
      const year = this.draft.date.slice(0, 4)
      const slug = this.draft.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .split('-')
        .slice(0, 3)
        .join('-')

      if (!year && !slug) return ''
      return [year, slug].filter(Boolean).join('-')
    },

    /** Field name → error message. Empty object means the form is valid. */
    errors(): Record<string, string> {
      const errors: Record<string, string> = {}
      const draft = this.draft

      if (!draft.title.trim()) errors.title = 'A title is required.'

      if (!draft.date.trim()) {
        errors.date = 'A date is required.'
      } else if (!DATE_PATTERN.test(draft.date.trim())) {
        errors.date = 'Use YYYY-MM-DD, YYYY-MM or YYYY.'
      }

      if (draft.endDate.trim() && !DATE_PATTERN.test(draft.endDate.trim())) {
        errors.endDate = 'Use YYYY-MM-DD, YYYY-MM or YYYY.'
      }

      if (draft.endDate.trim() && draft.endDate.trim() < draft.date.trim()) {
        errors.endDate = 'The end date is before the start date.'
      }

      if (!draft.locationName.trim()) errors.locationName = 'Where was it?'
      if (!draft.country.trim()) errors.country = 'A country is required.'

      if (draft.countryCode.trim() && !/^[a-zA-Z]{2}$/.test(draft.countryCode.trim())) {
        errors.countryCode = 'Two letters, e.g. kh.'
      }

      if (!draft.description.trim()) errors.description = 'Write a sentence or two.'

      const id = (this.idTouched ? draft.id : this.suggestedId).trim()
      if (!id) {
        errors.id = 'An id is required.'
      } else if (isIdTaken(this.existingTrips, id, this.trip?.id)) {
        errors.id = 'Another trip already uses this id.'
      }

      return errors
    },

    isValid(): boolean {
      return Object.keys(this.errors).length === 0
    },

    /** Photos missing a URL or alt text — flagged inline, not blocking. */
    photoWarnings(): Record<number, string> {
      const warnings: Record<number, string> = {}

      this.draft.photos.forEach((photo, index) => {
        if (this.uploads[index]) {
          // Bytes are staged locally; the URL is filled in on save.
          if (!photo.alt.trim()) {
            warnings[index] = 'Add alt text — screen readers and broken images both use it.'
          }
        } else if (!photo.url.trim()) {
          warnings[index] = 'No image URL, and no file chosen.'
        } else if (isGooglePhotosAlbumLink(photo.url)) {
          warnings[index] =
            'That is an album link, not an image. Right-click the photo on Google Photos → Copy image address.'
        } else if (isSessionBoundPhotoUrl(photo.url)) {
          warnings[index] =
            'This link is tied to your Google account (authuser=), so it loads for you and fails for everyone else. Upload the file instead.'
        } else if (!photo.alt.trim()) {
          warnings[index] = 'Add alt text — screen readers and broken images both use it.'
        }
      })

      return warnings
    },
  },

  watch: {
    // Reload the draft each time the dialog opens, so a cancelled edit does not
    // leak into the next one.
    modelValue: {
      immediate: true,
      handler(open: boolean) {
        if (open) this.reset()
      },
    },

    /**
     * Also reset when the trip itself arrives.
     *
     * On the first open of a page load, `modelValue` flips to true before the
     * `trip` prop has been patched, so the handler above ran against a null trip
     * and left an empty form under an "Edit trip" heading. Every later open
     * worked, because `trip` was already populated from the previous one.
     *
     * Compared by id, not identity: the parent replaces its trip objects on
     * every background refresh, and re-running reset() then would wipe whatever
     * the user had typed.
     */
    trip(next: Trip | null, previous: Trip | null) {
      if (this.modelValue && next?.id !== previous?.id) this.reset()
    },
  },

  methods: {
    /** Re-truncate both dates when the user changes precision. */
    onPrecisionChange(next: DatePrecision | null) {
      if (!next) return

      this.datePrecision = next
      this.draft.date = withPrecision(this.draft.date, next)
      this.draft.endDate = withPrecision(this.draft.endDate, next)
    },

    reset() {
      this.submitted = false
      this.idTouched = this.trip !== null
      this.uploadError = ''
      this.clearUploads()

      if (!this.trip) {
        this.draft = emptyDraft()
        this.datePrecision = 'day'
        this.uploads = []
        return
      }

      // Adopt whatever precision the existing trip was written with, so editing
      // a childhood entry does not silently promote it to a fake exact date.
      this.datePrecision = precisionOf(this.trip.date)

      const trip = this.trip
      this.draft = {
        id: trip.id,
        title: trip.title,
        date: trip.date,
        endDate: trip.endDate ?? '',
        locationName: trip.location.name,
        country: trip.location.country,
        countryCode: trip.location.countryCode ?? '',
        chapter: trip.chapter,
        template: trip.template ?? DEFAULT_TEMPLATE,
        description: trip.description,
        highlights: [...(trip.highlights ?? [])],
        categories: [...(trip.categories ?? [])],
        // Deep copy so editing photos does not mutate the stored trip.
        photos: trip.photos.map((photo) => ({ ...photo })),
      }
      this.uploads = this.draft.photos.map(() => null)
    },

    /** Release object URLs so previews do not leak between openings. */
    clearUploads() {
      for (const upload of this.uploads) {
        if (upload) URL.revokeObjectURL(upload.previewUrl)
      }
      this.uploads = []
    },

    isCategoryOn(id: TripCategory): boolean {
      return this.draft.categories.includes(id)
    },

    /** Categories are a multi-select: a trip can be family *and* sea. */
    toggleCategory(id: TripCategory) {
      const index = this.draft.categories.indexOf(id)
      if (index === -1) this.draft.categories.push(id)
      else this.draft.categories.splice(index, 1)
    },

    error(field: string): string | undefined {
      return this.submitted ? this.errors[field] : undefined
    },

    addPhoto() {
      // A placeholder id keyed off the current length — good enough to keep
      // v-for stable while editing. save() renumbers them all to p1, p2, …
      this.draft.photos.push({ id: `new-${this.draft.photos.length}`, url: '', alt: '' })
      this.uploads.push(null)
    },

    removePhoto(index: number) {
      const [upload] = this.uploads.splice(index, 1)
      if (upload) URL.revokeObjectURL(upload.previewUrl)
      this.draft.photos.splice(index, 1)
    },

    movePhoto(index: number, delta: number) {
      const target = index + delta
      if (target < 0 || target >= this.draft.photos.length) return

      const [photo] = this.draft.photos.splice(index, 1)
      if (photo) this.draft.photos.splice(target, 0, photo)

      // Move the staged bytes with their row.
      const [upload] = this.uploads.splice(index, 1)
      this.uploads.splice(target, 0, upload ?? null)
    },

    /**
     * Decode, downscale and stage a chosen file. Nothing is uploaded yet — the
     * bytes ride along with `save` so cancelling the form commits nothing.
     */
    async onFilePicked(index: number, files: File[] | File | null) {
      const file = Array.isArray(files) ? files[0] : files
      if (!file) return

      this.uploadError = ''
      this.preparing = true

      try {
        const prepared = await prepareImage(file)

        const previous = this.uploads[index]
        if (previous) URL.revokeObjectURL(previous.previewUrl)

        const blob = new Blob([prepared.bytes as unknown as BlobPart], { type: 'image/jpeg' })
        this.uploads[index] = {
          bytes: prepared.bytes,
          previewUrl: URL.createObjectURL(blob),
          label: `${prepared.width}×${prepared.height}, ${formatBytes(prepared.size)}`,
        }

        // The row's URL is set on save, once the trip id is final.
        const photo = this.draft.photos[index]
        if (photo) {
          photo.url = ''
          if (!photo.alt.trim()) photo.alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
        }
      } catch (error) {
        this.uploadError =
          error instanceof ImageError ? error.message : `Could not read ${file.name}.`
      } finally {
        this.preparing = false
      }
    },

    /** Local preview for a staged upload, or the row's own URL. */
    previewPhoto(index: number): Photo {
      const upload = this.uploads[index]
      const photo = this.draft.photos[index]!

      return upload ? { ...photo, url: upload.previewUrl } : photo
    },

    hasContent(index: number): boolean {
      return Boolean(this.uploads[index] || this.draft.photos[index]?.url.trim())
    },

    close() {
      this.$emit('update:modelValue', false)
    },

    save() {
      this.submitted = true
      if (!this.isValid) return

      const draft = this.draft
      const endDate = draft.endDate.trim()
      const countryCode = draft.countryCode.trim().toLowerCase()

      // Built in one literal, in the same field order as the hand-written
      // entries in trips.ts — exported code should be indistinguishable from
      // code someone typed. Optional fields are spread in only when they have
      // content, so the export has no empty arrays or blank strings.
      const trip: Trip = {
        id: (this.idTouched ? draft.id : this.suggestedId).trim(),
        title: draft.title.trim(),
        date: draft.date.trim(),
        ...(endDate ? { endDate } : {}),
        location: {
          name: draft.locationName.trim(),
          country: draft.country.trim(),
          ...(countryCode ? { countryCode } : {}),
        },
        chapter: draft.chapter,
        template: draft.template,
        description: draft.description.trim(),
        ...(draft.highlights.length ? { highlights: [...draft.highlights] } : {}),
        ...(draft.categories.length ? { categories: [...draft.categories] } : {}),
        photos: [],
      }

      // Keep only rows that actually have an image, pairing each with its staged
      // bytes so indexes stay aligned after the filter.
      const rows = draft.photos
        .map((photo, index) => ({ photo, upload: this.uploads[index] ?? null }))
        .filter((row) => row.upload || row.photo.url.trim())

      const uploads: { path: string; bytes: Uint8Array }[] = []

      trip.photos = rows.map((row, index) => {
        // Uploaded files get a deterministic repo path derived from the final
        // trip id, so re-uploading a slot overwrites instead of piling up.
        const url = row.upload ? photoPath(trip.id, index) : row.photo.url.trim()
        if (row.upload) uploads.push({ path: url, bytes: row.upload.bytes })

        return {
          id: `p${index + 1}`,
          url,
          alt: row.photo.alt.trim() || draft.title.trim(),
          ...(row.photo.caption?.trim() ? { caption: row.photo.caption.trim() } : {}),
        }
      })

      this.$emit('save', { trip, uploads })
    },
  },
})
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="720"
    :fullscreen="$vuetify.display.smAndDown"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card class="editor">
      <div class="editor__head">
        <div>
          <p class="font-meta editor__eyebrow">{{ isEditing ? 'Edit trip' : 'New trip' }}</p>
          <h2 class="font-display editor__title">
            {{ isEditing ? draft.title || 'Untitled trip' : 'Add a memory' }}
          </h2>
        </div>
        <v-btn icon="$close" size="small" variant="text" aria-label="Close" @click="close" />
      </div>

      <v-card-text class="editor__body">
        <!-- ── Story ────────────────────────────────────────────────── -->
        <h3 class="font-meta editor__section">The trip</h3>

        <v-text-field
          v-model="draft.title"
          label="Title"
          placeholder="Cherry Blossoms and Vending Machines"
          :error-messages="error('title')"
        />

        <v-btn-toggle
          :model-value="datePrecision"
          density="comfortable"
          variant="outlined"
          divided
          rounded="lg"
          mandatory
          class="editor__precision"
          @update:model-value="onPrecisionChange"
        >
          <v-btn v-for="option in precisionOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </v-btn>
        </v-btn-toggle>

        <div class="editor__row">
          <!-- VDateInput defaults to an outside `prepend-icon`; moving it inside
               keeps these fields aligned with every other input in the form. -->
          <v-date-input
            v-model="startDateModel"
            label="Date"
            prepend-icon=""
            prepend-inner-icon="$calendar"
            :hint="precisionHint"
            persistent-hint
            clearable
            :error-messages="error('date')"
          />
          <v-date-input
            v-model="endDateModel"
            label="End date (optional)"
            prepend-icon=""
            prepend-inner-icon="$calendar"
            clearable
            :error-messages="error('endDate')"
          />
        </div>

        <div class="editor__row">
          <v-text-field
            v-model="draft.locationName"
            label="Place"
            placeholder="Tokyo"
            :error-messages="error('locationName')"
          />
          <v-text-field
            v-model="draft.country"
            label="Country"
            placeholder="Japan"
            :error-messages="error('country')"
          />
          <v-text-field
            v-model="draft.countryCode"
            label="Code"
            placeholder="jp"
            style="max-width: 110px"
            hint="For the flag"
            :error-messages="error('countryCode')"
          />
        </div>

        <v-select
          v-model="draft.chapter"
          :items="chapters"
          item-title="label"
          item-value="id"
          label="Life chapter"
        />

        <v-textarea
          v-model="draft.description"
          label="What happened?"
          rows="4"
          auto-grow
          hint="Blank lines become paragraph breaks."
          persistent-hint
          :error-messages="error('description')"
        />

        <v-combobox
          v-model="draft.highlights"
          label="Highlights"
          multiple
          chips
          closable-chips
          hint="Press Enter after each"
          persistent-hint
        />

        <div class="editor__categories">
          <p class="editor__field-label">What kind of trip was it?</p>
          <div class="editor__chips">
            <v-chip
              v-for="category in allCategories"
              :key="category.id"
              :prepend-icon="category.icon"
              :variant="isCategoryOn(category.id) ? 'flat' : 'outlined'"
              :color="isCategoryOn(category.id) ? 'primary' : undefined"
              :aria-pressed="isCategoryOn(category.id)"
              role="button"
              @click="toggleCategory(category.id)"
            >
              {{ category.label }}
            </v-chip>
          </div>
          <p class="editor__hint">Pick as many as fit — or none.</p>
        </div>

        <!-- ── Template ─────────────────────────────────────────────── -->
        <h3 class="font-meta editor__section">How it looks on the timeline</h3>

        <TemplatePicker
          v-model="draft.template"
          :photo-count="draft.photos.filter((p) => p.url.trim()).length"
        />

        <!-- ── Photos ───────────────────────────────────────────────── -->
        <h3 class="font-meta editor__section">
          Photos
          <span class="editor__section-note">first one is the cover</span>
        </h3>

        <v-alert
          v-if="uploadError"
          type="error"
          variant="tonal"
          rounded="lg"
          density="compact"
          class="mb-2"
        >
          {{ uploadError }}
        </v-alert>

        <div v-for="(photo, index) in draft.photos" :key="index" class="photo-row">
          <div class="photo-row__thumb">
            <TripPhoto
              v-if="hasContent(index)"
              :photo="previewPhoto(index)"
              size="thumb"
              :aspect-ratio="1"
              eager
            />
            <div v-else class="photo-row__empty">
              <v-icon icon="$imageOff" size="20" />
            </div>
          </div>

          <div class="photo-row__fields">
            <v-file-input
              :model-value="null"
              label="Upload a photo"
              density="compact"
              variant="outlined"
              rounded="lg"
              accept="image/*"
              prepend-icon=""
              prepend-inner-icon="$upload"
              hide-details
              :loading="preparing"
              @update:model-value="onFilePicked(index, $event)"
            />

            <p v-if="uploads[index]" class="photo-row__staged">
              <v-icon icon="$check" size="14" />
              Ready to upload — {{ uploads[index]?.label }}
            </p>

            <v-text-field
              v-else
              v-model="photo.url"
              label="…or paste an image URL"
              density="compact"
              placeholder="https://lh3.googleusercontent.com/…"
              hide-details
            />

            <v-text-field
              v-model="photo.alt"
              label="Alt text"
              density="compact"
              placeholder="Cherry blossoms over a canal"
              hide-details
            />
            <v-text-field
              v-model="photo.caption"
              label="Caption (optional)"
              density="compact"
              hide-details
            />
            <p v-if="photoWarnings[index]" class="photo-row__warning">
              <v-icon icon="$alert" size="14" />
              {{ photoWarnings[index] }}
            </p>
          </div>

          <div class="photo-row__tools">
            <v-btn
              icon="$prev"
              size="x-small"
              variant="text"
              :disabled="index === 0"
              aria-label="Move photo earlier"
              class="photo-row__up"
              @click="movePhoto(index, -1)"
            />
            <v-btn
              icon="$next"
              size="x-small"
              variant="text"
              :disabled="index === draft.photos.length - 1"
              aria-label="Move photo later"
              class="photo-row__down"
              @click="movePhoto(index, 1)"
            />
            <v-btn
              icon="$trash"
              size="x-small"
              variant="text"
              color="error"
              aria-label="Remove photo"
              @click="removePhoto(index)"
            />
          </div>
        </div>

        <v-btn
          prepend-icon="$plus"
          variant="tonal"
          class="editor__add-photo"
          @click="addPhoto"
        >
          Add a photo
        </v-btn>

        <!-- ── Id ───────────────────────────────────────────────────── -->
        <h3 class="font-meta editor__section">Advanced</h3>

        <v-text-field
          :model-value="idTouched ? draft.id : suggestedId"
          label="Id"
          :hint="idTouched ? 'Must be unique.' : 'Generated from the title and year.'"
          persistent-hint
          :error-messages="error('id')"
          @update:model-value="
            (value) => {
              idTouched = true
              draft.id = value
            }
          "
        />
      </v-card-text>

      <v-card-actions class="editor__actions">
        <p v-if="saveError" class="editor__invalid">
          <v-icon icon="$alert" size="16" />
          {{ saveError }}
        </p>
        <p v-else-if="submitted && !isValid" class="editor__invalid">
          <v-icon icon="$alert" size="16" />
          Some fields need attention.
        </p>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="close">Cancel</v-btn>
        <v-btn color="primary" prepend-icon="$check" :loading="saving" @click="save">
          {{ isEditing ? 'Save changes' : 'Add trip' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.editor {
  background: rgb(var(--v-theme-background));
}

.editor__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.5rem 0.5rem;
}

.editor__eyebrow {
  color: rgb(var(--v-theme-accent));
  margin-bottom: 0.3rem;
}

.editor__title {
  font-size: 1.6rem;
  color: rgb(var(--v-theme-primary));
}

.editor__body {
  padding: 0.5rem 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.editor__section {
  color: rgb(var(--v-theme-on-surface-variant));
  border-bottom: 1px solid rgb(var(--v-theme-surface-variant));
  padding-bottom: 0.45rem;
  margin-top: 1rem;
}

.editor__section-note {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 300;
  opacity: 0.8;
  margin-left: 0.5rem;
}

.editor__row {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.editor__row > * {
  flex: 1 1 0;
  min-width: 0;
}

/* VBtnGroup carries `overflow: hidden`, which makes its min-content height 0, so
   as a shrinkable item in this column flexbox it collapsed to nothing and the
   buttons rendered 2px tall. Pinning flex-shrink lets its own 40px stand. */
.editor__precision {
  align-self: flex-start;
  flex: 0 0 auto;
}

.editor__precision :deep(.v-btn) {
  font-size: 0.78rem;
  letter-spacing: 0;
}

.editor__field-label {
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 0.6rem;
}

.editor__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.editor__hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.editor__add-photo {
  align-self: flex-start;
}

.editor__actions {
  padding: 0.75rem 1.5rem 1.25rem;
  background: rgb(var(--v-theme-background));
}

.editor__invalid {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-error));
}

/* ── Photo rows ─────────────────────────────────────────────────────────── */

.photo-row {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgb(var(--v-theme-surface));
  border-radius: var(--radius-md);
}

.photo-row__thumb {
  flex: 0 0 72px;
}

.photo-row__empty {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border: 1px dashed rgb(var(--v-theme-surface-variant));
  border-radius: var(--radius-sm);
  color: rgb(var(--v-theme-on-surface-variant));
}

.photo-row__fields {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.photo-row__staged {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-success));
}

.photo-row__warning {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgb(var(--v-theme-warning));
}

.photo-row__tools {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

/* The reorder arrows are horizontal chevrons rotated to point up and down —
   there is no vertical pair in Vuetify's built-in aliases. Both rotate the same
   way: clockwise turns "<" into "^" and ">" into "v". */
.photo-row__up :deep(.v-icon),
.photo-row__down :deep(.v-icon) {
  transform: rotate(90deg);
}

/* ── Phone ──────────────────────────────────────────────────────────────── */

@media (max-width: 599px) {
  .editor__row {
    flex-direction: column;
    gap: 0.5rem;
  }

  .editor__row > * {
    width: 100%;
    max-width: none !important;
  }

  .photo-row {
    flex-wrap: wrap;
  }

  .photo-row__thumb {
    flex-basis: 56px;
  }
}
</style>
