import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudConsultation = {
  id: string
  organizationId: string
  patientId: string
  date: string
  time: string
  teeth: string[]
  acts: string
  notes: string
  prescription: string | null
}

export type CloudTreatment = {
  id: string
  organizationId: string
  patientId: string
  date: string
  tooth: string
  act: string
  code: string
  cost: number
  comment: string | null
  careStatus: string
  paymentStatus: string
}

export async function listConsultations(
  patientId: string,
  query: Record<string, string | number | undefined> = {},
) {
  const data = await cloudApi<Partial<CloudListResult<CloudConsultation>>>({
    method: 'GET',
    path: `/patients/${patientId}/consultations`,
    query,
  })
  return asList(data)
}

export async function createConsultation(patientId: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ consultation: CloudConsultation }>({
    method: 'POST',
    path: `/patients/${patientId}/consultations`,
    body,
  })
  return data.consultation
}

export async function updateConsultation(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ consultation: CloudConsultation }>({
    method: 'PATCH',
    path: `/consultations/${id}`,
    body,
  })
  return data.consultation
}

export async function listTreatments(
  patientId: string,
  query: Record<string, string | number | undefined> = {},
) {
  const data = await cloudApi<Partial<CloudListResult<CloudTreatment>>>({
    method: 'GET',
    path: `/patients/${patientId}/treatments`,
    query,
  })
  return asList(data)
}

export async function createTreatment(patientId: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ treatment: CloudTreatment }>({
    method: 'POST',
    path: `/patients/${patientId}/treatments`,
    body,
  })
  return data.treatment
}

export async function updateTreatment(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ treatment: CloudTreatment }>({
    method: 'PATCH',
    path: `/treatments/${id}`,
    body,
  })
  return data.treatment
}
