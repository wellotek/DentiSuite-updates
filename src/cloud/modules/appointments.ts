import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudAppointment = {
  id: string
  organizationId: string
  date: string
  time: string
  durationMin: number
  patientId: string
  patientName?: string
  motif: string
  practitioner: string
  dentistId: string | null
  status: string
  category: string
}

export async function listAppointments(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudAppointment>>>({
    method: 'GET',
    path: '/appointments',
    query,
  })
  return asList(data)
}

export async function createAppointment(body: Record<string, unknown>) {
  const data = await cloudApi<{ appointment: CloudAppointment }>({
    method: 'POST',
    path: '/appointments',
    body,
  })
  return data.appointment
}

export async function updateAppointment(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ appointment: CloudAppointment }>({
    method: 'PATCH',
    path: `/appointments/${id}`,
    body,
  })
  return data.appointment
}

export async function deleteAppointment(id: string) {
  await cloudApi({ method: 'DELETE', path: `/appointments/${id}` })
}
