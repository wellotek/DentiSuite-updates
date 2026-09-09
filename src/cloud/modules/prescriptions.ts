import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudPrescription = {
  id: string
  organizationId: string
  patientId: string
  date: string
  title: string
  dentistId: string | null
  dentistName: string | null
  advice: string | null
  lines?: Array<{ id: string; drug: string; posology: string; duration: string; notes: string | null }>
}

export async function listPrescriptions(
  patientId: string,
  query: Record<string, string | number | undefined> = {},
) {
  const data = await cloudApi<Partial<CloudListResult<CloudPrescription>>>({
    method: 'GET',
    path: `/patients/${patientId}/prescriptions`,
    query,
  })
  return asList(data)
}

export async function createPrescription(patientId: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ prescription: CloudPrescription }>({
    method: 'POST',
    path: `/patients/${patientId}/prescriptions`,
    body,
  })
  return data.prescription
}

export async function updatePrescription(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ prescription: CloudPrescription }>({
    method: 'PATCH',
    path: `/prescriptions/${id}`,
    body,
  })
  return data.prescription
}
