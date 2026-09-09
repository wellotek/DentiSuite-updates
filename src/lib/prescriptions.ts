import type { Prescription, PrescriptionDraft, PrescriptionLine } from '../types'
import { toISODate } from './agenda'

export interface PrescriptionTemplate {
  id: string
  title: string
  hint: string
  advice: string
  lines: Omit<PrescriptionLine, 'id'>[]
}

export const PRESCRIPTION_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: 'tpl-antalgique',
    title: 'Antalgique post-extraction',
    hint: 'Douleur après avulsion',
    advice: 'Glace 10 min / heure les 24 premières heures. Éviter le rinçage vigoureux et le tabac 48 h. Reconsulter si saignement persistant, fièvre ou douleur intense.',
    lines: [
      { drug: 'Paracétamol 1 g', posology: '1 comprimé toutes les 6 heures si douleur (max 4 g/j)', duration: '3 à 5 jours', notes: '' },
      { drug: 'Ibuprofène 400 mg', posology: '1 comprimé 3 fois par jour au cours des repas', duration: '3 jours', notes: 'Contre-indiqué si ulcère, asthme, grossesse' },
    ],
  },
  {
    id: 'tpl-postop',
    title: 'Soin post-opératoire',
    hint: 'Chirurgies, implants, sutures',
    advice: 'Alimentation tiède et molle 48 h. Ne pas toucher la plaie. Dormir tête légèrement surélevée. Contrôle selon rendez-vous.',
    lines: [
      { drug: 'Paracétamol 1 g', posology: '1 comprimé 3 à 4 fois par jour si douleur', duration: '5 jours', notes: '' },
      { drug: 'Bain de bouche chlorhexidine 0,12 %', posology: '1 rinçage 30 secondes, 2 fois par jour', duration: '7 jours', notes: 'À débuter 24 h après l’intervention' },
      { drug: 'Acide tranexamique (si prescrit)', posology: 'Compresse imbibée 10 minutes en cas de saignement', duration: '48 h', notes: '' },
    ],
  },
  {
    id: 'tpl-atb',
    title: 'Antibiothérapie',
    hint: 'Infection, cellulite, prophylaxie',
    advice: 'Terminer impérativement la durée prescrite. Prendre les comprimés à heures régulières. Consulter en urgence si éruption, gêne respiratoire ou diarrhée sévère.',
    lines: [
      { drug: 'Amoxicilline 1 g', posology: '1 comprimé 2 fois par jour', duration: '7 jours', notes: 'Vérifier l’absence d’allergie aux pénicillines' },
      { drug: 'Métronidazole 500 mg', posology: '1 comprimé 2 fois par jour', duration: '7 jours', notes: 'Éviter l’alcool pendant le traitement' },
    ],
  },
  {
    id: 'tpl-hygiene',
    title: 'Bains de bouche / hygiène',
    hint: 'Gingivite, après détartrage',
    advice: 'Brossage 2 à 3 fois par jour avec une brosse souple. Fil dentaire ou brossettes au quotidien. Réévaluation parodontale selon le plan de traitement.',
    lines: [
      { drug: 'Bain de bouche chlorhexidine 0,12 %', posology: '1 rinçage 30 secondes, 2 fois par jour après brossage', duration: '7 à 10 jours', notes: 'Peut colorer temporairement les dents' },
      { drug: 'Dentifrice fluoré 1450 ppm', posology: 'Brossage 2 minutes, 2 fois par jour', duration: 'En continu', notes: '' },
    ],
  },
  {
    id: 'tpl-gingivite',
    title: 'Inflammation gingivale',
    hint: 'Gencives douloureuses / saignantes',
    advice: 'Poursuivre un brossage doux malgré le saignement. Éviter les aliments très épicés. Contrôle après la phase d’hygiène.',
    lines: [
      { drug: 'Bain de bouche à base d’huiles essentielles', posology: '2 fois par jour', duration: '10 jours', notes: '' },
      { drug: 'Paracétamol 500 mg', posology: '1 à 2 comprimés si douleur (max 3 g/j)', duration: 'si besoin', notes: '' },
    ],
  },
  {
    id: 'tpl-urgence',
    title: 'Urgence douleur',
    hint: 'Pulpite, abcès en attente de soin',
    advice: 'Ne pas appliquer d’aspirine sur la gencive. Éviter les aliments très chauds ou sucrés du côté atteint. Revenir au cabinet si la douleur s’aggrave ou si un gonflement apparaît.',
    lines: [
      { drug: 'Paracétamol 1 g', posology: '1 comprimé toutes les 6 heures si douleur', duration: 'jusqu’au rendez-vous', notes: '' },
      { drug: 'Ibuprofène 400 mg', posology: '1 comprimé 3 fois par jour au repas', duration: '3 jours', notes: 'Sauf contre-indication' },
    ],
  },
]

export function newPrescriptionLine(partial?: Partial<PrescriptionLine>): PrescriptionLine {
  return {
    id: `ln${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    drug: '',
    posology: '',
    duration: '',
    notes: '',
    ...partial,
  }
}

export function linesFromTemplate(template: PrescriptionTemplate): PrescriptionLine[] {
  return template.lines.map((line) => newPrescriptionLine(line))
}

export function emptyPrescriptionDraft(today = toISODate(new Date())): PrescriptionDraft {
  return {
    patientName: '',
    date: today,
    title: 'Ordonnance',
    lines: [newPrescriptionLine()],
    advice: '',
    dentistName: '',
  }
}

export function draftFromTemplate(template: PrescriptionTemplate, today = toISODate(new Date())): PrescriptionDraft {
  return {
    ...emptyPrescriptionDraft(today),
    title: template.title,
    templateId: template.id,
    lines: linesFromTemplate(template),
    advice: template.advice,
  }
}

export function prescriptionSummary(rx: Pick<Prescription, 'lines'>) {
  return rx.lines
    .map((l) => l.drug.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ')
}
