/**
 * Reads the date a photo was taken from its EXIF block, so the editor can fill
 * in a trip's dates from the photos dropped into it.
 *
 * Deliberately tiny: JPEG only, and only the two date tags. The camera writes
 * `DateTimeOriginal` as local wall-clock text (`2019:03:28 14:05:11`), which is
 * exactly the calendar day the trip happened — so it is sliced as a string and
 * never goes through `new Date()`.
 *
 * `File.lastModified` is not used as a fallback: on phones it is the moment the
 * picker exported the file, which would stamp every trip with today's date.
 */

/** EXIF lives in the first APP1 segment; this is far more than it ever needs. */
const HEAD_BYTES = 256 * 1024

const TAG_DATE_TIME = 0x0132
const TAG_EXIF_IFD = 0x8769
const TAG_DATE_TIME_ORIGINAL = 0x9003
const TYPE_ASCII = 2

/** `YYYY-MM-DD` the photo was taken, or null if the file does not say. */
export async function readPhotoDate(file: File): Promise<string | null> {
  try {
    const buffer = await file.slice(0, HEAD_BYTES).arrayBuffer()
    return parseJpegDate(new DataView(buffer))
  } catch {
    // A truncated or odd file is not worth failing the upload over.
    return null
  }
}

function parseJpegDate(view: DataView): string | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null

  let offset = 2
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset)
    const length = view.getUint16(offset + 2)

    // APP1 starting with "Exif\0\0".
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966) {
      return parseTiffDate(view, offset + 10)
    }
    // Start of scan: image data follows, no metadata after this point.
    if (marker === 0xffda || (marker & 0xff00) !== 0xff00) return null

    offset += 2 + length
  }

  return null
}

function parseTiffDate(view: DataView, tiff: number): string | null {
  const order = view.getUint16(tiff)
  if (order !== 0x4949 && order !== 0x4d4d) return null
  const little = order === 0x4949

  const ifd0 = tiff + view.getUint32(tiff + 4, little)
  const exifPointer = findEntry(view, ifd0, TAG_EXIF_IFD, little)

  // Prefer the moment the shutter fired; DateTime is when the file was last
  // edited, which is still usually the same day.
  const original =
    exifPointer === null
      ? null
      : readAscii(view, tiff, findEntryOffset(view, tiff + exifPointer, TAG_DATE_TIME_ORIGINAL, little), little)
  const modified = readAscii(view, tiff, findEntryOffset(view, ifd0, TAG_DATE_TIME, little), little)

  return toTripDate(original) ?? toTripDate(modified)
}

/** Byte offset of the IFD entry for `tag`, or null. */
function findEntryOffset(view: DataView, ifd: number, tag: number, little: boolean): number | null {
  if (ifd + 2 > view.byteLength) return null

  const count = view.getUint16(ifd, little)
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12
    if (entry + 12 > view.byteLength) return null
    if (view.getUint16(entry, little) === tag) return entry
  }

  return null
}

/** The LONG value of an IFD entry — used for the Exif sub-IFD pointer. */
function findEntry(view: DataView, ifd: number, tag: number, little: boolean): number | null {
  const entry = findEntryOffset(view, ifd, tag, little)
  return entry === null ? null : view.getUint32(entry + 8, little)
}

function readAscii(view: DataView, tiff: number, entry: number | null, little: boolean): string | null {
  if (entry === null || view.getUint16(entry + 2, little) !== TYPE_ASCII) return null

  const length = view.getUint32(entry + 4, little)
  // Values over four bytes are stored elsewhere, pointed to from the entry.
  const start = length > 4 ? tiff + view.getUint32(entry + 8, little) : entry + 8
  if (start + length > view.byteLength) return null

  let text = ''
  for (let i = 0; i < length; i++) {
    const code = view.getUint8(start + i)
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text
}

/** `2019:03:28 14:05:11` → `2019-03-28`. Cameras write zeros when unset. */
function toTripDate(value: string | null): string | null {
  const match = value?.match(/^(\d{4}):(\d{2}):(\d{2})/)
  if (!match) return null

  const [, year, month, day] = match
  if (year === '0000' || month === '00' || day === '00') return null
  return `${year}-${month}-${day}`
}
