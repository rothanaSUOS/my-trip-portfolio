/**
 * Turn an authored description into display text.
 *
 * Descriptions in `src/data/trips.ts` are template literals, so wherever the
 * author wrapped a line in their editor there is a real `\n`. Rendering those
 * verbatim breaks sentences at arbitrary points ("Hanami in Ueno⏎Park").
 *
 * Markdown's rule is the intuitive one and the one authors already expect: a
 * single newline is just soft wrapping and collapses to a space; a blank line
 * is a deliberate paragraph break and is preserved. `.prose` in main.css sets
 * `white-space: pre-line`, which then renders the surviving newlines.
 */
export function formatStory(text: string): string {
  return text
    .split(/\n\s*\n/) // paragraphs, split on blank lines
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}

/** Same text as a single line — for card teasers, which clamp to three lines. */
export function toTeaser(text: string): string {
  return formatStory(text).replace(/\n+/g, ' ')
}
