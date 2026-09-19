import type { MedicationItem } from '../types'

/**
 * Catalogue initial odontologie — DCI / formes courantes.
 * Source: catalogue de référence DentiSuite (odonto).
 * Disponibilité marché ANPP / Algérie : NON VÉRIFIÉE — ne pas présenter comme
 * « médicament disponible en Algérie » sans contrôle officiel.
 */
export const MEDICATION_SOURCE_LABEL =
  'Catalogue initial DentiSuite (odontologie) — disponibilité marché non vérifiée (ANPP)'

function med(
  partial: Omit<MedicationItem, 'source' | 'status' | 'lastVerifiedAt' | 'market'> & {
    source?: string
    status?: MedicationItem['status']
    market?: string
  },
): MedicationItem {
  return {
    market: partial.market ?? 'référence générale',
    status: partial.status ?? 'active',
    source: partial.source ?? MEDICATION_SOURCE_LABEL,
    lastVerifiedAt: '2026-09-13',
    ...partial,
  }
}

/** Seed catalogue — intentionally modest and extensible via Settings / import. */
export const seedMedications: MedicationItem[] = [
  // Antibiotiques
  med({
    id: 'med-amox-500-gel',
    name: 'Amoxicilline',
    dci: 'Amoxicilline',
    dosage: '500 mg',
    form: 'Gélule',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-amox-1g-comp',
    name: 'Amoxicilline',
    dci: 'Amoxicilline',
    dosage: '1 g',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-amox-clav-500',
    name: 'Amoxicilline / Acide clavulanique',
    dci: 'Amoxicilline + Acide clavulanique',
    dosage: '500 mg / 62,5 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-amox-clav-1g',
    name: 'Amoxicilline / Acide clavulanique',
    dci: 'Amoxicilline + Acide clavulanique',
    dosage: '1 g / 125 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-metro-250',
    name: 'Métronidazole',
    dci: 'Métronidazole',
    dosage: '250 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-metro-500',
    name: 'Métronidazole',
    dci: 'Métronidazole',
    dosage: '500 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-spira-3mui',
    name: 'Spiramycine',
    dci: 'Spiramycine',
    dosage: '3 MUI',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-azithro-250',
    name: 'Azithromycine',
    dci: 'Azithromycine',
    dosage: '250 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-clinda-150',
    name: 'Clindamycine',
    dci: 'Clindamycine',
    dosage: '150 mg',
    form: 'Gélule',
    route: 'orale',
    family: 'antibiotique',
  }),
  // Antalgiques
  med({
    id: 'med-para-500',
    name: 'Paracétamol',
    dci: 'Paracétamol',
    dosage: '500 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antalgique',
  }),
  med({
    id: 'med-para-1g',
    name: 'Paracétamol',
    dci: 'Paracétamol',
    dosage: '1 g',
    form: 'Comprimé',
    route: 'orale',
    family: 'antalgique',
  }),
  med({
    id: 'med-para-codeine',
    name: 'Paracétamol / Codéine',
    dci: 'Paracétamol + Codéine',
    dosage: '500 mg / 30 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'antalgique',
  }),
  med({
    id: 'med-tramadol-50',
    name: 'Tramadol',
    dci: 'Tramadol',
    dosage: '50 mg',
    form: 'Gélule',
    route: 'orale',
    family: 'antalgique',
  }),
  // AINS
  med({
    id: 'med-ibup-400',
    name: 'Ibuprofène',
    dci: 'Ibuprofène',
    dosage: '400 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'anti-inflammatoire',
  }),
  med({
    id: 'med-ibup-600',
    name: 'Ibuprofène',
    dci: 'Ibuprofène',
    dosage: '600 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'anti-inflammatoire',
  }),
  med({
    id: 'med-diclo-50',
    name: 'Diclofénac',
    dci: 'Diclofénac',
    dosage: '50 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'anti-inflammatoire',
  }),
  med({
    id: 'med-ketop-100',
    name: 'Kétoprofène',
    dci: 'Kétoprofène',
    dosage: '100 mg',
    form: 'Gélule',
    route: 'orale',
    family: 'anti-inflammatoire',
  }),
  // Antiseptiques buccaux
  med({
    id: 'med-chx-012',
    name: 'Chlorhexidine',
    dci: 'Chlorhexidine digluconate',
    dosage: '0,12 %',
    form: 'Bain de bouche',
    route: 'buccale',
    family: 'antiseptique',
  }),
  med({
    id: 'med-chx-02',
    name: 'Chlorhexidine',
    dci: 'Chlorhexidine digluconate',
    dosage: '0,2 %',
    form: 'Bain de bouche',
    route: 'buccale',
    family: 'antiseptique',
  }),
  med({
    id: 'med-h2o2',
    name: 'Peroxyde d’hydrogène',
    dci: 'Peroxyde d’hydrogène',
    dosage: '10 volumes',
    form: 'Solution',
    route: 'buccale',
    family: 'antiseptique',
  }),
  // Anesthésiques locaux
  med({
    id: 'med-articaine-ep',
    name: 'Articaïne / Épinéphrine',
    dci: 'Articaïne + Épinéphrine',
    dosage: '4 % / 1:100 000',
    form: 'Cartouche injectable',
    route: 'injection locale',
    family: 'anesthesique',
  }),
  med({
    id: 'med-lidocaine-ep',
    name: 'Lidocaïne / Épinéphrine',
    dci: 'Lidocaïne + Épinéphrine',
    dosage: '2 % / 1:100 000',
    form: 'Cartouche injectable',
    route: 'injection locale',
    family: 'anesthesique',
  }),
  med({
    id: 'med-mepi',
    name: 'Mépivacaïne',
    dci: 'Mépivacaïne',
    dosage: '3 %',
    form: 'Cartouche injectable',
    route: 'injection locale',
    family: 'anesthesique',
  }),
  // Antifongiques
  med({
    id: 'med-nystatin',
    name: 'Nystatine',
    dci: 'Nystatine',
    dosage: '100 000 UI/ml',
    form: 'Suspension orale',
    route: 'orale',
    family: 'antifongique',
  }),
  med({
    id: 'med-miconazole-gel',
    name: 'Miconazole',
    dci: 'Miconazole',
    dosage: '2 %',
    form: 'Gel buccal',
    route: 'buccale',
    family: 'antifongique',
  }),
  // Pédiatrie / divers odonto
  med({
    id: 'med-para-sirop',
    name: 'Paracétamol',
    dci: 'Paracétamol',
    dosage: '120 mg/5 ml',
    form: 'Sirop',
    route: 'orale',
    family: 'antalgique',
  }),
  med({
    id: 'med-ibup-sirop',
    name: 'Ibuprofène',
    dci: 'Ibuprofène',
    dosage: '100 mg/5 ml',
    form: 'Suspension',
    route: 'orale',
    family: 'anti-inflammatoire',
  }),
  med({
    id: 'med-amox-sirop',
    name: 'Amoxicilline',
    dci: 'Amoxicilline',
    dosage: '250 mg/5 ml',
    form: 'Suspension',
    route: 'orale',
    family: 'antibiotique',
  }),
  med({
    id: 'med-prednisolone-20',
    name: 'Prednisolone',
    dci: 'Prednisolone',
    dosage: '20 mg',
    form: 'Comprimé',
    route: 'orale',
    family: 'corticoide',
  }),
  med({
    id: 'med-omeprazole-20',
    name: 'Oméprazole',
    dci: 'Oméprazole',
    dosage: '20 mg',
    form: 'Gélule',
    route: 'orale',
    family: 'autre',
  }),
]
