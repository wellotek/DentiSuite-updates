/**
 * Import reproductible de la Nomenclature Nationale MIPH (médecine humaine).
 *
 * Source officielle (ne pas modifier le fichier XLSX) :
 * https://www.miph.gov.dz/fr/nomenclature-nationale-des-produits-pharmaceutiques/
 * Fichier : clean_NOMENCLATURE.VERSION.AOUT_.2026-.xlsx
 *
 * Usage :
 *   npm run medications:import-miph
 *
 * Prérequis : package `xlsx` (devDependency).
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_FILE = path.join(
  root,
  'data/official/clean_NOMENCLATURE.VERSION.AOUT_.2026-.xlsx',
)
const OUT_JSON = path.join(root, 'src/data/miph-nomenclature-aout-2026.json')
const OUT_META = path.join(root, 'src/data/miphNomenclatureMeta.ts')

const SOURCE_LABEL =
  'Nomenclature Nationale des produits pharmaceutiques — Ministère de l’Industrie Pharmaceutique (Algérie)'
const SOURCE_VERSION = 'Août 2026'
const SOURCE_URL =
  'https://www.miph.gov.dz/fr/nomenclature-nationale-des-produits-pharmaceutiques/'
const SOURCE_FILE_NAME = 'clean_NOMENCLATURE.VERSION.AOUT_.2026-.xlsx'
const IMPORT_DATE = new Date().toISOString().slice(0, 10)
const SHEET_NAME = 'Nomenclature Aout 2026'
const HEADER_ROW = 15
const DATA_START = 16

/** Colonnes réellement présentes dans le fichier officiel (index 0-based). */
const COL = {
  num: 0,
  registrationNumber: 1,
  code: 2,
  dci: 3,
  name: 4,
  form: 5,
  dosage: 6,
  packaging: 7,
  laboratory: 12,
}

function cell(row, idx) {
  const v = row?.[idx]
  if (v == null) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

function sanitizeIdPart(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80)
}

function makeId(registrationNumber, seq) {
  const base = `miph-${sanitizeIdPart(registrationNumber) || 'row'}`
  return seq > 1 ? `${base}-${seq}` : base
}

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error('Fichier source manquant:', SOURCE_FILE)
    process.exit(1)
  }

  const wb = XLSX.readFile(SOURCE_FILE)
  const ws = wb.Sheets[SHEET_NAME]
  if (!ws) {
    console.error('Feuille introuvable:', SHEET_NAME, 'disponibles:', wb.SheetNames)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const header = rows[HEADER_ROW] || []
  const expected = [
    'N°',
    'N°ENREGISTREMENT',
    'CODE',
    'DENOMINATION COMMUNE INTERNATIONALE',
    'NOM DE MARQUE',
    'FORME',
    'DOSAGE',
    'CONDITIONNEMENT',
  ]
  for (let i = 0; i < expected.length; i++) {
    const got = cell(header, i).toUpperCase()
    if (!got.includes(expected[i].slice(0, 6).toUpperCase()) && got !== expected[i]) {
      // soft check — log only
      console.warn('En-tête col', i, 'attendu ~', expected[i], 'obtenu', cell(header, i))
    }
  }

  /** @type {Map<string, number>} */
  const seenReg = new Map()
  const items = []

  for (let i = DATA_START; i < rows.length; i++) {
    const row = rows[i]
    const registrationNumber = cell(row, COL.registrationNumber)
    const name = cell(row, COL.name)
    const dci = cell(row, COL.dci)
    if (!registrationNumber || (!name && !dci)) continue

    const seq = (seenReg.get(registrationNumber) || 0) + 1
    seenReg.set(registrationNumber, seq)

    items.push({
      id: makeId(registrationNumber, seq),
      name: name || dci,
      dci: dci || name,
      dosage: cell(row, COL.dosage),
      form: cell(row, COL.form),
      packaging: cell(row, COL.packaging) || undefined,
      laboratory: cell(row, COL.laboratory) || undefined,
      officialCode: cell(row, COL.code) || undefined,
      registrationNumber,
      origin: 'official',
      status: 'active',
      source: SOURCE_LABEL,
      sourceVersion: SOURCE_VERSION,
      importedAt: IMPORT_DATE,
      lastVerifiedAt: IMPORT_DATE,
      market: 'Algérie',
    })
  }

  // Idempotence: stable sort by registration then id
  items.sort((a, b) =>
    a.registrationNumber.localeCompare(b.registrationNumber) || a.id.localeCompare(b.id),
  )

  const payload = {
    meta: {
      source: SOURCE_LABEL,
      sourceUrl: SOURCE_URL,
      sourceFile: SOURCE_FILE_NAME,
      sourceVersion: SOURCE_VERSION,
      sheet: SHEET_NAME,
      importedAt: IMPORT_DATE,
      entryCount: items.length,
      columnsImported: [
        'N°ENREGISTREMENT',
        'CODE',
        'DENOMINATION COMMUNE INTERNATIONALE',
        'NOM DE MARQUE',
        'FORME',
        'DOSAGE',
        'CONDITIONNEMENT',
        'LABORATOIRES DETENTEUR DE LA DECISION D\'ENREGISTREMENT',
      ],
      columnsExcluded: [
        'LISTE',
        'P1',
        'P2',
        'OBS',
        'PAYS DU LABORATOIRE',
        'DATE D\'ENREGISTREMENT INITIAL',
        'DATE D\'ENREGISTREMENT FINAL',
        'TYPE',
        'STATUT',
        'DUREE DE STABILITE',
      ],
      contentHash: crypto
        .createHash('sha256')
        .update(JSON.stringify(items.map((x) => x.registrationNumber)))
        .digest('hex')
        .slice(0, 16),
    },
    medications: items,
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload), 'utf8')

  fs.writeFileSync(
    OUT_META,
    `/** Auto-généré par scripts/import-miph-nomenclature.mjs — ne pas éditer à la main. */
export const MIPH_NOMENCLATURE_META = ${JSON.stringify(payload.meta, null, 2)} as const
`,
    'utf8',
  )

  console.log('Import OK')
  console.log('  version:', SOURCE_VERSION)
  console.log('  entrées:', items.length)
  console.log('  json:', OUT_JSON)
  console.log('  meta:', OUT_META)
}

main()
