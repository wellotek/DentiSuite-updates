import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudMedia = {
  id: string
  organizationId: string
  patientId: string
  title: string
  kind: string
  mime: string
  originalName: string
  size: number
  status: string
  createdAt: string
}

export async function listMedia(
  patientId: string,
  query: Record<string, string | number | undefined> = {},
) {
  const data = await cloudApi<Partial<CloudListResult<CloudMedia>>>({
    method: 'GET',
    path: `/patients/${patientId}/media`,
    query,
  })
  return asList(data)
}

export async function createMediaUpload(patientId: string, body: Record<string, unknown>) {
  return cloudApi<{
    media: CloudMedia
    upload: { url: string; method: string; headers: Record<string, string>; expiresAt: string }
  }>({
    method: 'POST',
    path: `/patients/${patientId}/media`,
    body,
  })
}

export async function completeMedia(id: string) {
  const data = await cloudApi<{ media: CloudMedia }>({
    method: 'POST',
    path: `/media/${id}/complete`,
    body: {},
  })
  return data.media
}

export async function getMediaDownloadUrl(id: string) {
  const data = await cloudApi<{ downloadUrl?: string; url?: string; expiresAt?: string }>({
    method: 'GET',
    path: `/media/${id}/url`,
  })
  const url = data.downloadUrl || data.url
  if (!url) throw new Error('Download URL missing')
  return { url, expiresAt: data.expiresAt }
}

export async function deleteMedia(id: string) {
  await cloudApi({ method: 'DELETE', path: `/media/${id}` })
}

/**
 * Upload file bytes to signed URL (no R2 credentials — temporary signed URL only).
 */
export async function putToSignedUrl(
  upload: { url: string; method: string; headers: Record<string, string> },
  file: Blob,
) {
  const res = await fetch(upload.url, {
    method: upload.method || 'PUT',
    headers: upload.headers || {},
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`)
  }
}
