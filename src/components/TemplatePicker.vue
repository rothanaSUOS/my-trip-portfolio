<script lang="ts">
import { defineComponent, type PropType } from 'vue'

import { TEMPLATES, templateMeta } from '@/data/templates'
import type { TripTemplate } from '@/types/trip'

/**
 * Visual template chooser for the editor.
 *
 * Each option is a miniature abstract of the layout — blocks standing in for
 * photo and text — rather than a text label, because "Collage" versus "Frame"
 * means nothing until you can see the shape.
 */
export default defineComponent({
  name: 'TemplatePicker',

  props: {
    modelValue: { type: String as PropType<TripTemplate>, required: true },
    /** Photos currently on the trip, so we can warn when a layout wants more. */
    photoCount: { type: Number, default: 0 },
  },

  emits: {
    'update:modelValue': (value: string) => typeof value === 'string',
  },

  data() {
    return {
      templates: TEMPLATES,
    }
  },

  computed: {
    selected() {
      return templateMeta(this.modelValue)
    },

    /** Set when the chosen layout shows more photos than the trip has. */
    warning(): string {
      const needed = this.selected.photosUsed
      if (this.photoCount >= needed) return ''

      return this.photoCount === 0
        ? 'This layout needs a photo — add one below.'
        : `This layout shows ${needed} photos; you have ${this.photoCount}. It will fall back to one.`
    },
  },
})
</script>

<template>
  <div class="picker">
    <div class="picker__grid">
      <button
        v-for="template in templates"
        :key="template.id"
        type="button"
        class="picker__option"
        :class="{ 'picker__option--active': template.id === modelValue }"
        :aria-pressed="template.id === modelValue"
        @click="$emit('update:modelValue', template.id)"
      >
        <!-- Miniature abstract of each layout. -->
        <span class="picker__preview" :class="`picker__preview--${template.id}`">
          <template v-if="template.id === 'panel'">
            <i class="ph ph--photo" /><i class="ph ph--line" /><i class="ph ph--line ph--short" />
          </template>
          <template v-else-if="template.id === 'window'">
            <i class="ph ph--fill" /><i class="ph ph--line ph--over" />
          </template>
          <template v-else-if="template.id === 'frame'">
            <i class="ph ph--mount"><i class="ph ph--photo" /></i
            ><i class="ph ph--line ph--light" />
          </template>
          <template v-else-if="template.id === 'collage'">
            <i class="ph ph--pair"><i class="ph ph--photo" /><i class="ph ph--photo ph--drop" /></i
            ><i class="ph ph--line" />
          </template>
          <template v-else>
            <i class="ph ph--fill" /><i class="ph ph--float" />
          </template>
        </span>

        <span class="picker__label">{{ template.label }}</span>
      </button>
    </div>

    <p class="picker__hint">{{ selected.hint }}</p>

    <p v-if="warning" class="picker__warning">
      <v-icon icon="$alert" size="15" />
      {{ warning }}
    </p>
  </div>
</template>

<style scoped>
.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(84px, 1fr));
  gap: 0.6rem;
}

.picker__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.4rem 0.5rem;
  background: rgb(var(--v-theme-surface));
  border: 2px solid rgb(var(--v-theme-surface-variant));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.picker__option:hover {
  border-color: rgb(var(--v-theme-accent));
}

.picker__option--active {
  border-color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-surface-bright));
}

.picker__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}

/* ── Miniature layout previews ──────────────────────────────────────────── */

.picker__preview {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;
  aspect-ratio: 4 / 5;
  padding: 4px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface-bright));
  overflow: hidden;
}

.picker__preview--frame {
  background: rgb(var(--v-theme-deep));
}

.ph {
  display: block;
  border-radius: 3px;
}

.ph--photo {
  flex: 1 1 auto;
  background: rgb(var(--v-theme-accent));
  opacity: 0.55;
}

.ph--fill {
  position: absolute;
  inset: 0;
  background: rgb(var(--v-theme-accent));
  opacity: 0.55;
  border-radius: 0;
}

.ph--line {
  height: 4px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.45;
}

.ph--short {
  width: 60%;
}

.ph--light {
  background: #fff;
  opacity: 0.9;
}

.ph--over {
  position: absolute;
  left: 5px;
  right: 30%;
  bottom: 6px;
  background: #fff;
  opacity: 0.95;
}

.ph--mount {
  flex: 1 1 auto;
  display: flex;
  padding: 3px;
  background: #fff;
  border-radius: 5px;
}

.ph--pair {
  flex: 1 1 auto;
  display: flex;
  gap: 3px;
  align-items: flex-start;
}

.ph--pair > .ph--photo {
  flex: 1 1 0;
  align-self: stretch;
}

.ph--drop {
  margin-top: 25%;
}

.ph--float {
  position: absolute;
  inset: 30% 12%;
  background: #fff;
  opacity: 0.95;
  border-radius: 5px;
}

/* ── Hint / warning ─────────────────────────────────────────────────────── */

.picker__hint {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-on-surface-variant));
}

.picker__warning {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: rgb(var(--v-theme-warning));
}
</style>
