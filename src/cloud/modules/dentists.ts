import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudDentist = {
  id: string
  organizationId: string
  firstName: string
  lastName: string
  specialty: string
  photo: string | null
  color: string
}

export async function listDentists(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudDentist>>>({
    method: 'GET',
    path: '/dentists',
    query,
  })
  return asList(data)
}

export async function createDentist(body: Record<string, unknown>) {
  const data = await cloudApi<{ dentist: CloudDentist }>({ method: 'POST', path: '/dentists', body })
  return data.dentist
}

export async function updateDentist(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ dentist: CloudDentist }>({
    method: 'PATCH',
    path: `/dentists/${id}`,
    body,
  })
  return data.dentist
}

export async function deleteDentist(id: string) {
  await cloudApi({ method: 'DELETE', path: `/dentists/${id}` })
}
