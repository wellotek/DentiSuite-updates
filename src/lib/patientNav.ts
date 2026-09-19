import type { Location } from 'react-router-dom'

/** Navigation state for contextual back / patient context (no invented context). */
export type PatientNavState = {
  returnTo?: string
  returnLabel?: string
  fromPatientId?: string
}

export function readPatientNavState(location: Location): PatientNavState {
  const state = location.state
  if (!state || typeof state !== 'object') return {}
  const s = state as Record<string, unknown>
  return {
    returnTo: typeof s.returnTo === 'string' ? s.returnTo : undefined,
    returnLabel: typeof s.returnLabel === 'string' ? s.returnLabel : undefined,
    fromPatientId: typeof s.fromPatientId === 'string' ? s.fromPatientId : undefined,
  }
}

export function patientChartPath(patientId: string) {
  return `/patients/${patientId}`
}

export function withPatientReturn(
  patientId: string,
  returnTo: string,
  returnLabel?: string,
): PatientNavState {
  return { fromPatientId: patientId, returnTo, returnLabel }
}

export function openFromPatient(
  patientId: string,
  returnLabel?: string,
): PatientNavState {
  return {
    fromPatientId: patientId,
    returnTo: patientChartPath(patientId),
    returnLabel,
  }
}
