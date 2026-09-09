import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudProsthesis = {
  id: string
  organizationId: string
  patientId: string
  patientName?: string
  type: string
  tooth: string
  lab: string
  sentAt: string
  expectedAt: string | null
  notes: string | null
  status: string
}

export async function listProstheses(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudProsthesis>>>({
    method: 'GET',
    path: '/prostheses',
    query,
  })
  return asList(data)
}

export async function createProsthesis(patientId: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ prosthesis: CloudProsthesis }>({
    method: 'POST',
    path: `/patients/${patientId}/prostheses`,
    body,
  })
  return data.prosthesis
}

export async function updateProsthesis(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ prosthesis: CloudProsthesis }>({
    method: 'PATCH',
    path: `/prostheses/${id}`,
    body,
  })
  return data.prosthesis
}
