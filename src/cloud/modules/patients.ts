import { cloudApi } from '../api'
import {
  createCloudPatient,
  listCloudPatients,
  updateCloudPatient,
} from '../patientsRepository'
import type { CloudPatient, CloudPatientCreateInput, CloudPatientUpdateInput } from '../types'

export { listCloudPatients, createCloudPatient, updateCloudPatient }
export type { CloudPatient, CloudPatientCreateInput, CloudPatientUpdateInput }

export async function getCloudPatient(id: string) {
  const data = await cloudApi<{ patient: CloudPatient }>({
    method: 'GET',
    path: `/patients/${id}`,
  })
  return data.patient
}

export async function deleteCloudPatient(id: string) {
  await cloudApi({ method: 'DELETE', path: `/patients/${id}` })
}
