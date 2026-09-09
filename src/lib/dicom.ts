export type DicomPhotometric = 'MONOCHROME1' | 'MONOCHROME2' | 'RGB' | 'unknown'

export interface DicomImage {
  rows: number
  cols: number
  photometric: DicomPhotometric
  windowCenter: number
  windowWidth: number
  pixels: Float32Array
  min: number
  max: number
  jpegBytes?: Uint8Array
}

const VR_LONG = new Set(['OB', 'OW', 'OF', 'OD', 'OL', 'OV', 'SQ', 'UC', 'UR', 'UT', 'UN'])

function u16(view: DataView, offset: number, le = true) {
  return view.getUint16(offset, le)
}

function u32(view: DataView, offset: number, le = true) {
  return view.getUint32(offset, le)
}

function readString(bytes: Uint8Array, start: number, length: number) {
  let s = ''
  for (let i = 0; i < length; i++) {
    const c = bytes[start + i]
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s.trim().replace(/\0/g, '')
}

export function isDicomBuffer(buffer: ArrayBuffer) {
  if (buffer.byteLength < 132) return false
  const bytes = new Uint8Array(buffer)
  return (
    String.fromCharCode(bytes[128], bytes[129], bytes[130], bytes[131]) === 'DICM' ||
    (bytes[0] === 8 && bytes[1] === 0)
  )
}

export function parseDicom(buffer: ArrayBuffer): DicomImage {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let offset = 0
  if (buffer.byteLength >= 132 && String.fromCharCode(bytes[128], bytes[129], bytes[130], bytes[131]) === 'DICM') {
    offset = 132
  }

  const tags = new Map<string, { vr: string; value: Uint8Array }>()
  let little = true
  let explicit = true

  // File meta (0002,*) is always explicit LE
  while (offset + 8 <= bytes.length) {
    const group = u16(view, offset, true)
    if (group !== 2) break
    offset = readElement(view, bytes, offset, true, true, tags)
  }

  const ts = getString(tags, '00020010')
  if (ts.includes('1.2.840.10008.1.2.2')) {
    little = false
    explicit = true
  } else if (ts === '1.2.840.10008.1.2' || ts.endsWith('.1.2')) {
    little = true
    explicit = false
  } else {
    little = true
    explicit = true
  }

  while (offset + 8 <= bytes.length) {
    offset = readElement(view, bytes, offset, little, explicit, tags)
  }

  const jpeg = extractJpeg(tags.get('7FE00010')?.value)
  if (jpeg) {
    return {
      rows: getNumber(tags, '00280010', 0),
      cols: getNumber(tags, '00280011', 0),
      photometric: photometricOf(getString(tags, '00280004')),
      windowCenter: getNumber(tags, '00281050', 128),
      windowWidth: getNumber(tags, '00281051', 256),
      pixels: new Float32Array(0),
      min: 0,
      max: 255,
      jpegBytes: jpeg,
    }
  }

  const rows = getNumber(tags, '00280010')
  const cols = getNumber(tags, '00280011')
  if (!rows || !cols) throw new Error('Image DICOM incomplète (lignes/colonnes manquantes).')

  const bitsAllocated = getNumber(tags, '00280100', 16)
  const pixelRep = getNumber(tags, '00280103', 0)
  const samples = getNumber(tags, '00280002', 1)
  const slope = getNumber(tags, '00281053', 1)
  const intercept = getNumber(tags, '00281052', 0)
  const pixelBuf = tags.get('7FE00010')?.value
  if (!pixelBuf) throw new Error('Aucune donnée pixel dans ce fichier DICOM.')

  const pixels = decodePixels(pixelBuf, rows, cols, bitsAllocated, pixelRep, samples, little, slope, intercept)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const wc = getNumber(tags, '00281050', (min + max) / 2)
  const ww = getNumber(tags, '00281051', Math.max(1, max - min))

  return {
    rows,
    cols,
    photometric: photometricOf(getString(tags, '00280004')),
    windowCenter: wc,
    windowWidth: ww,
    pixels,
    min,
    max,
  }
}

function photometricOf(value: string): DicomPhotometric {
  if (value.includes('MONOCHROME1')) return 'MONOCHROME1'
  if (value.includes('MONOCHROME2')) return 'MONOCHROME2'
  if (value.includes('RGB')) return 'RGB'
  return 'unknown'
}

function getString(tags: Map<string, { vr: string; value: Uint8Array }>, tag: string) {
  const item = tags.get(tag)
  if (!item) return ''
  return readString(item.value, 0, item.value.length)
}

function getNumber(tags: Map<string, { vr: string; value: Uint8Array }>, tag: string, fallback = 0) {
  const raw = getString(tags, tag)
  if (!raw) {
    const item = tags.get(tag)
    if (!item) return fallback
    if (item.value.length >= 2 && (item.vr === 'US' || item.vr === 'SS')) {
      return new DataView(item.value.buffer, item.value.byteOffset, item.value.byteLength).getUint16(0, true)
    }
    if (item.value.length >= 4 && (item.vr === 'UL' || item.vr === 'FL')) {
      return new DataView(item.value.buffer, item.value.byteOffset, item.value.byteLength).getUint32(0, true)
    }
    return fallback
  }
  const first = raw.split('\\')[0]
  const n = Number(first)
  return Number.isFinite(n) ? n : fallback
}

function readElement(
  view: DataView,
  bytes: Uint8Array,
  offset: number,
  little: boolean,
  explicit: boolean,
  tags: Map<string, { vr: string; value: Uint8Array }>,
) {
  const group = u16(view, offset, little)
  const element = u16(view, offset + 2, little)
  const tag = group.toString(16).padStart(4, '0').toUpperCase() + element.toString(16).padStart(4, '0').toUpperCase()
  let pos = offset + 4
  let vr = 'UN'
  let length = 0

  if (group === 0xfffe) {
    length = u32(view, pos, little)
    pos += 4
    if (length === 0xffffffff) length = 0
    return pos + Math.max(0, length)
  }

  if (explicit) {
    vr = String.fromCharCode(bytes[pos], bytes[pos + 1])
    pos += 2
    if (VR_LONG.has(vr)) {
      pos += 2
      length = u32(view, pos, little)
      pos += 4
    } else {
      length = u16(view, pos, little)
      pos += 2
    }
  } else {
    length = u32(view, pos, little)
    pos += 4
    vr = 'UN'
  }

  if (length === 0xffffffff) {
    if (vr === 'SQ' || tag === '7FE00010') {
      const end = skipUndefined(view, bytes, pos, little)
      tags.set(tag, { vr, value: bytes.subarray(pos, end) })
      return end
    }
    length = 0
  }

  const safeLen = Math.max(0, Math.min(length, bytes.length - pos))
  tags.set(tag, { vr, value: bytes.subarray(pos, pos + safeLen) })
  return pos + safeLen
}

function skipUndefined(view: DataView, bytes: Uint8Array, offset: number, little: boolean) {
  let pos = offset
  while (pos + 8 <= bytes.length) {
    const group = u16(view, pos, little)
    const element = u16(view, pos + 2, little)
    const length = u32(view, pos + 4, little)
    pos += 8
    if (group === 0xfffe && element === 0xe0dd) return pos
    if (length === 0xffffffff) {
      pos = skipUndefined(view, bytes, pos, little)
    } else {
      pos += length
    }
  }
  return bytes.length
}

function extractJpeg(pixelData?: Uint8Array) {
  if (!pixelData || pixelData.length < 12) return undefined
  const view = new DataView(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength)
  if (u16(view, 0, true) !== 0xfffe || u16(view, 2, true) !== 0xe000) return undefined
  let pos = 0
  let first = true
  while (pos + 8 <= pixelData.length) {
    const group = u16(view, pos, true)
    const element = u16(view, pos + 2, true)
    const length = u32(view, pos + 4, true)
    pos += 8
    if (group === 0xfffe && element === 0xe0dd) break
    if (first) {
      first = false
      pos += length === 0xffffffff ? 0 : length
      continue
    }
    if (length > 2 && pixelData[pos] === 0xff && pixelData[pos + 1] === 0xd8) {
      return pixelData.subarray(pos, pos + length)
    }
    pos += length
  }
  return undefined
}

function decodePixels(
  buf: Uint8Array,
  rows: number,
  cols: number,
  bitsAllocated: number,
  pixelRep: number,
  samples: number,
  little: boolean,
  slope: number,
  intercept: number,
) {
  const count = rows * cols
  const out = new Float32Array(count)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  if (samples >= 3 && bitsAllocated === 8) {
    for (let i = 0; i < count && i * 3 + 2 < buf.length; i++) {
      out[i] = 0.2126 * buf[i * 3] + 0.7152 * buf[i * 3 + 1] + 0.0722 * buf[i * 3 + 2]
    }
    return out
  }
  if (bitsAllocated <= 8) {
    for (let i = 0; i < count && i < buf.length; i++) out[i] = buf[i] * slope + intercept
    return out
  }
  for (let i = 0; i < count && i * 2 + 1 < buf.length; i++) {
    const raw = pixelRep === 1 ? view.getInt16(i * 2, little) : view.getUint16(i * 2, little)
    out[i] = raw * slope + intercept
  }
  return out
}

export function renderDicomToImageData(image: DicomImage, center: number, width: number) {
  const { rows, cols, pixels, photometric } = image
  const data = new Uint8ClampedArray(rows * cols * 4)
  const ww = Math.max(1, width)
  const low = center - ww / 2
  const invert = photometric === 'MONOCHROME1'
  for (let i = 0; i < pixels.length; i++) {
    let v = ((pixels[i] - low) / ww) * 255
    if (invert) v = 255 - v
    const g = v < 0 ? 0 : v > 255 ? 255 : v
    const o = i * 4
    data[o] = g
    data[o + 1] = g
    data[o + 2] = g
    data[o + 3] = 255
  }
  return new ImageData(data, cols, rows)
}

export async function dicomThumbnailDataUrl(buffer: ArrayBuffer) {
  const parsed = parseDicom(buffer)
  if (parsed.jpegBytes) {
    return blobToDataUrl(bytesToBlob(parsed.jpegBytes, 'image/jpeg'))
  }
  const imageData = renderDicomToImageData(parsed, parsed.windowCenter, parsed.windowWidth)
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 400 / Math.max(parsed.cols, parsed.rows))
  canvas.width = Math.max(1, Math.round(parsed.cols * scale))
  canvas.height = Math.max(1, Math.round(parsed.rows * scale))
  const tmp = document.createElement('canvas')
  tmp.width = parsed.cols
  tmp.height = parsed.rows
  tmp.getContext('2d')?.putImageData(imageData, 0, 0)
  canvas.getContext('2d')?.drawImage(tmp, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

export function bytesToBlob(bytes: Uint8Array, type: string) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type })
}
