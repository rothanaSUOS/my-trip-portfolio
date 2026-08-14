/**
 * Prepares uploaded photos for committing to the repo.
 *
 * A modern phone photo is 4-12MB. Committing those verbatim would bloat the repo
 * permanently — git keeps every version forever — and make the site slow for
 * visitors. So every upload is re-encoded to a sane size before it goes near
 * GitHub.
 *
 * Canvas can read a local `File` without tainting, so this all happens in the
 * browser with no upload round-trip.
 */

/** Long edge, in pixels. The largest the site ever displays is the lightbox. */
const MAX_EDGE = 2000

/** JPEG quality. 0.82 is the usual sweet spot before artefacts get visible. */
const QUALITY = 0.82

export interface PreparedImage {
  /** JPEG bytes, ready to base64 and commit. */
  bytes: Uint8Array
  width: number
  height: number
  /** Size in bytes after re-encoding, for showing the user what was saved. */
  size: number
}

export class ImageError extends Error {}

/** Decode, downscale to fit MAX_EDGE, and re-encode as JPEG. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError(`${file.name} is not an image.`)
  }

  const bitmap = await decode(file)

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) throw new ImageError('Could not read the image (no canvas context).')

    // White backdrop: transparent PNGs would otherwise composite onto black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob) throw new ImageError('Could not re-encode the image.')

    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      width,
      height,
      size: blob.size,
    }
  } finally {
    // ImageBitmap holds decoded pixels until closed; HTMLImageElement does not
    // have close() and is collected normally.
    if ('close' in bitmap) bitmap.close()
  }
}

/** `createImageBitmap` where available, falling back to an <img> decode. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // Honours EXIF orientation, so portrait phone photos are not sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Some formats (older HEIC handling, odd CMYK JPEGs) fail here but still
      // decode through an <img>, so fall through rather than giving up.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } catch {
    throw new ImageError(`Could not read ${file.name}. Try a JPEG or PNG.`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * A small data URL of an image, for showing a just-uploaded photo before the
 * real file is reachable.
 *
 * Deliberately much smaller than the committed image (800px, q0.6): these are
 * held in localStorage, which caps out around 5MB, and a full-size JPEG in
 * base64 would blow that budget after two or three photos.
 */
export async function makePreviewDataUrl(bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' })
  const bitmap = await createImageBitmap(blob)

  try {
    const PREVIEW_EDGE = 800
    const scale = Math.min(1, PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (!context) throw new ImageError('Could not build a preview.')

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.6)
  } finally {
    bitmap.close()
  }
}

/**
 * Repo path for a photo: `photos/<trip-id>-<n>.jpg`. Deterministic per trip and
 * index so re-uploading the same slot overwrites rather than accumulating.
 */
export function photoPath(tripId: string, index: number): string {
  return `photos/${tripId}-${String(index + 1).padStart(2, '0')}.jpg`
}

/** Human-readable size, for the upload confirmation line. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
