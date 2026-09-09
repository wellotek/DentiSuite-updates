import type { ToothStatus } from '../types'

export const UPPER_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
] as const

export const LOWER_TEETH = [
  '48', '47', '46', '45', '44', '43', '42', '41',
  '31', '32', '33', '34', '35', '36', '37', '38',
] as const

const TOOTH_TYPE: Record<string, string> = {
  '1': 'Incisive centrale',
  '2': 'Incisive latérale',
  '3': 'Canine',
  '4': '1re prémolaire',
  '5': '2e prémolaire',
  '6': '1re molaire',
  '7': '2e molaire',
  '8': 'Dent de sagesse',
}

export type ToothKind = 'incisor' | 'canine' | 'premolar' | 'molar'

export function toothKind(number: string): ToothKind {
  const digit = number[1]
  if (digit === '1' || digit === '2') return 'incisor'
  if (digit === '3') return 'canine'
  if (digit === '4' || digit === '5') return 'premolar'
  return 'molar'
}

export function toothLabel(number: string) {
  const quadrant = number[0]
  const type = TOOTH_TYPE[number[1]] ?? 'Dent'
  const arch = quadrant === '1' || quadrant === '2' ? 'supérieure' : 'inférieure'
  const side = quadrant === '1' || quadrant === '4' ? 'droite' : 'gauche'
  return `${type} ${arch} ${side}`
}

export const TOOTH_STATUSES: {
  id: ToothStatus
  label: string
  hint: string
  swatch: string
  tooth: string
}[] = [
  { id: 'saine', label: 'Saine', hint: 'Aucune pathologie', swatch: 'bg-white border border-slate-300', tooth: 'bg-white text-slate-700 border-slate-200' },
  { id: 'carie', label: 'Carie', hint: 'Soin à réaliser', swatch: 'bg-red-500', tooth: 'bg-red-500 text-white border-red-600' },
  { id: 'a_traiter', label: 'Soin à faire', hint: 'Acte planifié', swatch: 'bg-red-400', tooth: 'bg-red-400 text-white border-red-500' },
  { id: 'a_surveiller', label: 'À surveiller', hint: 'Contrôle ultérieur', swatch: 'bg-orange-400', tooth: 'bg-orange-400 text-white border-orange-500' },
  { id: 'traitee', label: 'Traitée', hint: 'Soin réalisé', swatch: 'bg-emerald-500', tooth: 'bg-emerald-500 text-white border-emerald-600' },
  { id: 'obturation', label: 'Obturation', hint: 'Composite / amalgame', swatch: 'bg-emerald-600', tooth: 'bg-emerald-600 text-white border-emerald-700' },
  { id: 'couronne', label: 'Couronne', hint: 'Prothèse unitaire', swatch: 'bg-amber-400', tooth: 'bg-amber-400 text-amber-950 border-amber-500' },
  { id: 'facette', label: 'Facette', hint: 'Esthétique', swatch: 'bg-sky-400', tooth: 'bg-sky-400 text-sky-950 border-sky-500' },
  { id: 'implant', label: 'Implant', hint: 'Remplacement', swatch: 'bg-teal-500', tooth: 'bg-teal-500 text-white border-teal-600' },
  { id: 'extraction', label: 'Extraction', hint: 'Dent absente', swatch: 'bg-slate-400', tooth: 'bg-slate-300 text-slate-500 border-slate-400 line-through' },
]

export function statusMeta(status: ToothStatus) {
  return TOOTH_STATUSES.find((s) => s.id === status) ?? TOOTH_STATUSES[0]
}

export const COMMON_ACTS = [
  'Détartrage',
  'Contrôle',
  'Radiographie',
  'Soin de carie',
  'Composite',
  'Obturation',
  'Dévitalisation',
  'Couronne',
  'Extraction',
  'Implant',
  'Facette',
  'Empreinte',
]

export function suggestStatusFromAct(act: string): ToothStatus | null {
  const a = act.toLowerCase()
  if (a.includes('carie')) return 'carie'
  if (a.includes('extract')) return 'extraction'
  if (a.includes('couronne')) return 'couronne'
  if (a.includes('implant')) return 'implant'
  if (a.includes('facette')) return 'facette'
  if (a.includes('composite') || a.includes('obtur')) return 'obturation'
  if (a.includes('dévital') || a.includes('devital') || a.includes('trait')) return 'traitee'
  return null
}

export function patientHasAllergies(antecedents: string, hasAllergies: boolean) {
  if (hasAllergies) return true
  return /allerg/i.test(antecedents)
}
