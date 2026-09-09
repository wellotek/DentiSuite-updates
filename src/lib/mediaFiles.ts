export const MEDIA_MAX_BYTES = 80 * 1024 * 1024

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i
const DICOM_EXT = /\.(dcm|dicom)$/i

export function isImageFile(file: File) {
  const lower = file.name.toLowerCase()
  const mime = (file.type || '').toLowerCase()
  if (DICOM_EXT.test(lower) || mime === 'application/dicom') return false
  return mime.startsWith('image/') || IMAGE_EXT.test(lower)
}

export function isDicomFile(file: File) {
  const lower = file.name.toLowerCase()
  const mime = (file.type || '').toLowerCase()
  return DICOM_EXT.test(lower) || mime === 'application/dicom'
}

export type MediaErrorCode =
  | 'too_large'
  | 'inaccessible'
  | 'unsupported'
  | 'folder'
  | 'ipc'
  | 'patient'
  | 'save'
  | 'generic'

export function mediaErrorCode(error: unknown): MediaErrorCode {
  const message = error instanceof Error ? error.message : String(error || '')
  if (/too_large|taille/i.test(message)) return 'too_large'
  if (/inaccessible|notreadableerror/i.test(message)) return 'inaccessible'
  if (/unsupported|mediaType/i.test(message)) return 'unsupported'
  if (/folder|EACCES|EPERM|permission/i.test(message)) return 'folder'
  if (/ipc|preload|dentisuite/i.test(message)) return 'ipc'
  if (/patient/i.test(message)) return 'patient'
  if (/save|ENOSPC|empty/i.test(message)) return 'save'
  return 'generic'
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('inaccessible'))
    reader.onload = () => {
      const text = String(reader.result || '')
      const comma = text.indexOf(',')
      resolve(comma >= 0 ? text.slice(comma + 1) : text)
    }
    reader.readAsDataURL(file)
  })
}

export async function saveMediaBlob(patientId: string, fileId: string, file: File) {
  if (!patientId) throw new Error('patient')
  if (file.size > MEDIA_MAX_BYTES) throw new Error('too_large')
  let buffer: ArrayBuffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw new Error('inaccessible')
  }
  if (!buffer.byteLength) throw new Error('inaccessible')

  if (window.dentisuite?.saveMedia) {
    let dataBase64: string
    try {
      dataBase64 = await fileToBase64(file)
    } catch {
      throw new Error('inaccessible')
    }
    let result: string | { ok?: boolean; filename?: string; error?: string }
    try {
      result = await window.dentisuite.saveMedia({
        patientId,
        fileId,
        name: file.name,
        dataBase64,
      })
    } catch {
      throw new Error('ipc')
    }
    if (typeof result === 'string' && result) {
      return { filename: result, dataUrl: undefined as string | undefined, buffer }
    }
    if (result && typeof result === 'object' && result.ok && result.filename) {
      return { filename: result.filename, dataUrl: undefined as string | undefined, buffer }
    }
    throw new Error((result && typeof result === 'object' && result.error) || 'save')
  }

  const mime = file.type || 'application/octet-stream'
  return {
    filename: `${fileId}${file.name.match(/\.[^.]+$/)?.[0] || ''}`,
    dataUrl: `data:${mime};base64,${await fileToBase64(file)}`,
    buffer,
  }
}

export async function loadMediaBuffer(media: { patientId: string; filename: string; dataUrl?: string }) {
  if (window.dentisuite?.readMedia) {
    let b64: string | null = null
    try {
      b64 = await window.dentisuite.readMedia({ patientId: media.patientId, filename: media.filename })
    } catch {
      throw new Error('ipc')
    }
    if (b64) return base64ToBuffer(b64)
  }
  if (media.dataUrl) {
    const raw = media.dataUrl.split(',')[1] ?? ''
    return base64ToBuffer(raw)
  }
  throw new Error('inaccessible')
}

export async function removeMediaBlob(patientId: string, filename: string) {
  if (window.dentisuite?.deleteMedia) {
    await window.dentisuite.deleteMedia({ patientId, filename })
  }
}

export function downloadBuffer(filename: string, buffer: ArrayBuffer, mime: string) {
  const blob = new Blob([new Uint8Array(buffer)], { type: mime || 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function base64ToBuffer(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function imageThumbnail(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Aperçu image impossible'))
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const scale = Math.min(1, 320 / Math.max(img.width, img.height))
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.onerror = () => reject(new Error('Aperçu image impossible'))
      img.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}
