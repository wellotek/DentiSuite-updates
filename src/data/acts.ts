import type { ActCategory, ActItem, ToothStatus } from '../types'

export const ACT_CATEGORIES: { id: ActCategory; label: string }[] = [
  { id: 'consultation', label: 'Consultations' },
  { id: 'soin', label: 'Soins' },
  { id: 'prothese', label: 'Prothèses' },
  { id: 'chirurgie', label: 'Chirurgie' },
  { id: 'radio', label: 'Radios' },
]

export const defaultActCatalog: ActItem[] = [
  { id: 'act-c01', code: 'CS-01', name: 'Consultation', category: 'consultation', tariff: 2500, favorite: false, toothStatus: 'saine' },
  { id: 'act-c02', code: 'CS-02', name: 'Contrôle', category: 'consultation', tariff: 1500, favorite: false, toothStatus: 'traitee' },
  { id: 'act-c03', code: 'CS-03', name: 'Urgence / douleur', category: 'consultation', tariff: 3500, favorite: false, toothStatus: 'a_surveiller' },
  { id: 'act-s01', code: 'SO-10', name: 'Détartrage', category: 'soin', tariff: 4000, favorite: true, toothStatus: 'traitee' },
  { id: 'act-s02', code: 'SO-20', name: 'Composite', category: 'soin', tariff: 6000, favorite: true, toothStatus: 'obturation' },
  { id: 'act-s03', code: 'SO-21', name: 'Soin de carie', category: 'soin', tariff: 5000, favorite: false, toothStatus: 'a_traiter' },
  { id: 'act-s04', code: 'SO-22', name: 'Obturation', category: 'soin', tariff: 5500, favorite: false, toothStatus: 'obturation' },
  { id: 'act-s05', code: 'SO-30', name: 'Dévitalisation', category: 'soin', tariff: 8000, favorite: false, toothStatus: 'traitee' },
  { id: 'act-s06', code: 'SO-31', name: 'Coiffage pulpaire', category: 'soin', tariff: 4500, favorite: false, toothStatus: 'a_surveiller' },
  { id: 'act-p01', code: 'PR-10', name: 'Couronne', category: 'prothese', tariff: 18000, favorite: true, toothStatus: 'couronne' },
  { id: 'act-p02', code: 'PR-11', name: 'Facette', category: 'prothese', tariff: 12000, favorite: false, toothStatus: 'facette' },
  { id: 'act-p03', code: 'PR-12', name: 'Bridge (élément)', category: 'prothese', tariff: 15000, favorite: false, toothStatus: 'couronne' },
  { id: 'act-p04', code: 'PR-20', name: 'Empreinte', category: 'prothese', tariff: 4000, favorite: false, toothStatus: 'a_traiter' },
  { id: 'act-p05', code: 'PR-21', name: 'Inlay-core', category: 'prothese', tariff: 10000, favorite: false, toothStatus: 'couronne' },
  { id: 'act-ch01', code: 'CH-10', name: 'Extraction', category: 'chirurgie', tariff: 6000, favorite: true, toothStatus: 'extraction' },
  { id: 'act-ch02', code: 'CH-11', name: 'Extraction chirurgicale', category: 'chirurgie', tariff: 12000, favorite: false, toothStatus: 'extraction' },
  { id: 'act-ch03', code: 'CH-20', name: 'Implant', category: 'chirurgie', tariff: 45000, favorite: false, toothStatus: 'implant' },
  { id: 'act-r01', code: 'RX-10', name: 'Radio rétroalvéolaire', category: 'radio', tariff: 1500, favorite: false, toothStatus: 'saine' },
  { id: 'act-r02', code: 'RX-20', name: 'Panoramique', category: 'radio', tariff: 4000, favorite: false, toothStatus: 'saine' },
  { id: 'act-r03', code: 'RX-11', name: 'Bite-wing', category: 'radio', tariff: 2000, favorite: false, toothStatus: 'saine' },
]

export function toothStatusForCare(act: ActItem, careStatus: 'a_faire' | 'fait'): ToothStatus {
  if (careStatus === 'a_faire') return 'a_traiter'
  return act.toothStatus === 'saine' ? 'traitee' : act.toothStatus
}

export function searchActs(catalog: ActItem[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return catalog.slice(0, 8)
  return catalog.filter(
    (a) =>
      a.code.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q),
  )
}
