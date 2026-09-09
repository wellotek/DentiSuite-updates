import type { Prosthesis, ProsthesisStatus } from '../types'
import { toISODate } from './agenda'

export const PROSTHESIS_TYPES = [
  'Couronne céramo-métallique',
  'Couronne zircone',
  'Couronne céramique',
  'Bridge',
  'Bridge céramo-métallique',
  'Inlay-core',
  'Facettes céramiques',
  'Prothèse amovible partielle',
  'Prothèse amovible complète',
  'Pilier implantaire',
  'Gouttière / splint',
] as const

export type ProsthesisUiStatus = 'fabrication' | 'recu' | 'pose' | 'annulee'

export const PROSTHESIS_STATUSES: { id: ProsthesisUiStatus; label: string; className: string }[] = [
  { id: 'fabrication', label: 'En cours', className: 'bg-amber-50 text-amber-800' },
  { id: 'recu', label: 'Reçue', className: 'bg-teal-50 text-teal-800' },
  { id: 'pose', label: 'Posée', className: 'bg-emerald-50 text-emerald-800' },
  { id: 'annulee', label: 'Annulée', className: 'bg-slate-100 text-slate-600' },
]

export function normalizeProsthesisStatus(status: ProsthesisStatus): ProsthesisUiStatus {
  if (status === 'envoye') return 'fabrication'
  return status
}

export function prosthesisStatusMeta(status: ProsthesisStatus) {
  const id = normalizeProsthesisStatus(status)
  return PROSTHESIS_STATUSES.find((s) => s.id === id) ?? PROSTHESIS_STATUSES[0]
}

export function isProsthesisOpen(item: Pick<Prosthesis, 'status'>) {
  return item.status !== 'pose' && item.status !== 'annulee'
}

export function isProsthesisOverdue(item: Pick<Prosthesis, 'expectedAt' | 'status'>, today = toISODate(new Date())) {
  return Boolean(item.expectedAt && item.expectedAt < today && isProsthesisOpen(item))
}
