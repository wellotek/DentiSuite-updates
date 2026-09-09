import { CloudClientError, mapCloudFailure } from './errors'
import type { CloudRequestInput } from './types'

function bridge() {
  return typeof window !== 'undefined' ? window.dentisuite : undefined
}

function scrubClientBody(body: unknown): unknown {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return body
  const out = { ...(body as Record<string, unknown>) }
  delete out.organizationId
  delete out.orgId
  delete out.userId
  delete out.membershipId
  delete out.token
  return out
}

/**
 * Generic authenticated Cloud API call via Main IPC allowlist.
 * Never sends orgId; token stays in Main.
 */
export async function cloudApi<T = unknown>(input: CloudRequestInput): Promise<T> {
  const api = bridge()
  if (!api?.cloudRequest) {
    throw new CloudClientError('disabled', 'NO_BRIDGE', 'Cloud IPC bridge unavailable', 0)
  }
  const result = (await api.cloudRequest({
    ...input,
    body: scrubClientBody(input.body),
  })) as
    | { ok: true; status: number; data: unknown }
    | { ok: false; code: string; message: string; status: number }

  if (!result || result.ok !== true) {
    throw mapCloudFailure(result || { code: 'UNKNOWN', message: 'Cloud API request failed' })
  }
  return result.data as T
}

export type CloudListResult<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export function asList<T>(data: Partial<CloudListResult<T>> | null | undefined): CloudListResult<T> {
  const items = Array.isArray(data?.items) ? data!.items : []
  return {
    items,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    total: data?.total ?? items.length,
    totalPages: data?.totalPages ?? 1,
  }
}
