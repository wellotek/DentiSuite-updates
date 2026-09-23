import type { ClinicSettings, Dentist, Patient, Prescription } from '../types'
import { parseISODate } from './agenda'
import printCss from '../components/prescriptions/prescriptionPrint.css?raw'
import printEleganteCss from '../components/prescriptions/prescriptionPrintElegante.css?raw'
import {
  DEFAULT_RX_FOOTER_AR,
  resolvePrescriptionPrintLayout,
  withRxPrintPrefs,
} from './rxPrintPrefs'
import { dentistName } from './dentists'
import { displayAge } from './age'
import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline'
import interLatin500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?inline'
import interLatin600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?inline'
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?inline'
import { escapeHtml, printHtmlViaIframe } from '../print'

const PRINT_FONT = "'Inter'"
const PRINT_TEXT =
  `font-family:${PRINT_FONT} !important;font-weight:400 !important;font-style:normal !important;font-synthesis:none !important;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision`

const PRINT_FACES = [
  { family: 'Inter', data: interLatin400 },
  { family: 'Inter Medium', data: interLatin500 },
  { family: 'Inter SemiBold', data: interLatin600 },
  { family: 'Inter Bold', data: interLatin700 },
] as const

function asFontDataUri(data: string) {
  if (data.startsWith('data:')) return data.replace(/^data:[^;]+/, 'data:font/woff2')
  return `data:font/woff2;base64,${data}`
}

function fontBuffer(data: string) {
  const uri = asFontDataUri(data)
  const marker = 'base64,'
  const idx = uri.indexOf(marker)
  const b64 = idx >= 0 ? uri.slice(idx + marker.length) : data
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function fontFaceCss(family: string, uri: string) {
  return `@font-face {
      font-family: '${family}';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url('${uri}') format('woff2');
    }`
}

function embeddedFontCss() {
  return PRINT_FACES.map((face) => fontFaceCss(face.family, asFontDataUri(face.data))).join('\n')
}

function printFontsReady(doc: Document) {
  return PRINT_FACES.every(({ family }) => doc.fonts.check(`400 16px "${family}"`))
}

function withTimeout(promise: Promise<unknown>, ms: number) {
  return Promise.race([promise, new Promise<void>((resolve) => window.setTimeout(resolve, ms))])
}

function logPdfError(stage: string, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error))
  console.error(`[PDF] ${stage}:`, err.message, err.stack)
}

async function registerPrintFonts(doc: Document) {
  console.log('[PDF] Loading fonts')
  try {
    const FontFaceCtor = doc.defaultView?.FontFace
    if (FontFaceCtor) {
      await withTimeout(
        Promise.all(
          PRINT_FACES.map(async ({ family, data }) => {
            try {
              const loaded = await new FontFaceCtor(family, fontBuffer(data), {
                weight: '400',
                style: 'normal',
                display: 'block',
              }).load()
              doc.fonts.add(loaded)
            } catch (error) {
              logPdfError('FontFace.load failed', error)
            }
          }),
        ),
        2500,
      )
    }
    await withTimeout(Promise.resolve(doc.fonts.ready), 1500)
    console.log('[PDF] document.fonts.ready completed')
    console.log('[PDF] Inter available', printFontsReady(doc))
  } catch (error) {
    logPdfError('Font load failed — printing anyway', error)
  }
}

export type PrescriptionPrintContext = {
  patient?: Pick<Patient, 'firstName' | 'lastName' | 'phone' | 'age' | 'birthDate'>
  dentist?: Pick<Dentist, 'firstName' | 'lastName' | 'specialty'>
}

const DEFAULT_TOOTH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="rxTooth" x1="20" y1="8" x2="100" y2="112">
      <stop offset="0%" stop-color="#7ec8e3"/>
      <stop offset="100%" stop-color="#1d6fa5"/>
    </linearGradient>
  </defs>
  <path fill="url(#rxTooth)" d="M60 10c-16 0-28 12-30 26-2 16 4 28 10 42 4 10 6 20 7 28 1 8 6 14 13 14s12-6 13-14c1-8 3-18 7-28 6-14 12-26 10-42C88 22 76 10 60 10z"/>
  <path fill="#e8f6fb" opacity=".35" d="M48 22c8-6 20-6 26 2 2 3-2 5-5 3-7-4-14-4-21 0-3 2-6-1-0-5z"/>
</svg>`

export async function printPrescription(
  rx: Prescription,
  settings: ClinicSettings,
  locale = 'fr-DZ',
  context?: PrescriptionPrintContext,
) {
  console.log('[PDF] Button clicked')
  console.log('[PDF] Starting print pipeline')
  try {
    console.log('[PDF] Creating print document')
    const html = buildPrescriptionHtml(rx, settings, locale, context)
    console.log('[PDF] Injecting HTML/CSS')
    await printHtmlViaIframe({
      html,
      mode: 'a4-preview',
      title: 'Aperçu d’impression',
      onReady: async (doc) => {
        console.log('[PDF] iframe loaded')
        await registerPrintFonts(doc)
        console.log('[PDF] Calling print')
      },
    })
    console.log('[PDF] Print completed')
  } catch (error) {
    logPdfError('Print failed', error)
  }
}

/** Same HTML as print/PDF — for on-screen preview without opening the print dialog. */
export function prescriptionPreviewHtml(
  rx: Prescription,
  settings: ClinicSettings,
  locale = 'fr-DZ',
  context?: PrescriptionPrintContext,
) {
  return buildPrescriptionHtml(rx, settings, locale, context)
}

/** Exported for structure tests — visual markup preserved from legacy engine. */
export function buildPrescriptionHtml(
  rx: Prescription,
  settings: ClinicSettings,
  locale: string,
  context?: PrescriptionPrintContext,
) {
  const resolved = withRxPrintPrefs(settings)
  if (resolvePrescriptionPrintLayout(rx, resolved) === 'elegante') {
    return buildElegantPrescriptionHtml(rx, resolved, context)
  }
  const date = parseISODate(rx.date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const logo = settings.logo
    ? `<img class="logo" src="${escapeHtml(settings.logo)}" alt="" />`
    : `<div class="rx-mark">Rx</div>`
  const watermark = settings.logo
    ? `<div class="watermark" aria-hidden="true"><img src="${escapeHtml(settings.logo)}" alt="" /></div>`
    : ''
  const meds = rx.lines.filter((l) => l.drug.trim())
  const lines = meds
    .map(
      (line, i) => `<article class="med">
        <div class="med-n">${i + 1}</div>
        <div class="med-body">
          <p class="med-name">${escapeHtml(line.drug)}</p>
          <p class="med-posology normal-text">${escapeHtml(line.posology || '—')}</p>
          ${line.notes.trim() ? `<p class="med-note normal-text">${escapeHtml(line.notes)}</p>` : ''}
        </div>
        <div class="med-duration">${escapeHtml(line.duration || '—')}</div>
      </article>`,
    )
    .join('')

  const layoutCss = printCss.replace(/@import\s+url\([^)]+\)\s*;/g, '').trimStart()

  return `<!DOCTYPE html>
<html lang="fr" class="prescription-pdf" style="${PRINT_TEXT}">
<head>
  <meta charset="utf-8" />
  <title>Ordonnance — ${escapeHtml(rx.patientName)}</title>
  <style>
    ${embeddedFontCss()}
    ${layoutCss}
  </style>
</head>
<body class="prescription-pdf" style="${PRINT_TEXT}">
  <div class="sheet prescription-pdf" style="${PRINT_TEXT}">
    ${watermark}
    <header>
      <div class="brand">
        ${logo}
        <div>
          <h1 class="clinic-name">${escapeHtml(settings.name)}</h1>
          <p class="clinic-meta normal-text">${escapeHtml(settings.address)}</p>
          <p class="clinic-meta normal-text">${escapeHtml(settings.phone)}${settings.email ? ` · ${escapeHtml(settings.email)}` : ''}</p>
        </div>
      </div>
      <div class="doc-title">
        <p class="kicker">Document médical</p>
        <h2>ORDONNANCE</h2>
        <p class="subtitle">${escapeHtml(rx.title)}</p>
      </div>
    </header>
    <div class="meta">
      <div class="meta-card">
        <p class="meta-label">Patient</p>
        <p class="meta-value">${escapeHtml(rx.patientName || '—')}</p>
        ${
          rx.patientBirthDate
            ? `<p class="meta-sub normal-text">Né(e) le : ${escapeHtml(
                rx.patientBirthDate.split('-').reverse().join('/'),
              )}</p>`
            : ''
        }
        ${
          rx.patientAge != null && Number.isFinite(rx.patientAge)
            ? `<p class="meta-sub normal-text">Âge : ${escapeHtml(String(rx.patientAge))} ans</p>`
            : ''
        }
      </div>
      <div class="meta-card right">
        <p class="meta-label">Date</p>
        <p class="meta-value" style="text-transform:capitalize;">${escapeHtml(date)}</p>
      </div>
    </div>
    <p class="section-label">Prescription</p>
    <div class="meds">
      ${lines || `<p class="empty">Aucun médicament prescrit.</p>`}
    </div>
    ${
      rx.advice.trim()
        ? `<div class="advice"><strong>Conseils / remarques</strong><p class="normal-text">${escapeHtml(rx.advice).replace(/\n/g, '<br />')}</p></div>`
        : ''
    }
    <div class="bottom">
      <p class="legal normal-text">${escapeHtml(settings.name)} — ordonnance destinée au patient. Ne pas photocopier sans mention.</p>
      <div class="sign">
        <p class="who">${escapeHtml(rx.dentistName || 'Le praticien')}</p>
        <div class="line">Cachet et signature</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

function splitPatientName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: fullName.trim(), lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

function elegantPatient(rx: Prescription, context?: PrescriptionPrintContext) {
  if (context?.patient) {
    const liveAge = displayAge(context.patient)
    return {
      firstName: context.patient.firstName || '',
      lastName: context.patient.lastName || '',
      phone: context.patient.phone || rx.patientPhone || '',
      age:
        liveAge != null && Number.isFinite(liveAge)
          ? String(liveAge)
          : rx.patientAge != null
            ? String(rx.patientAge)
            : '',
    }
  }
  const split = splitPatientName(rx.patientName || '')
  return {
    firstName: split.firstName,
    lastName: split.lastName,
    phone: rx.patientPhone || '',
    age: rx.patientAge != null && Number.isFinite(rx.patientAge) ? String(rx.patientAge) : '',
  }
}

function elegantPractitioner(rx: Prescription, settings: ClinicSettings, context?: PrescriptionPrintContext) {
  const latin = context?.dentist
    ? dentistName(context.dentist)
    : rx.dentistName || ''
  return {
    arabic: settings.practitionerArabicName?.trim() || '',
    latin,
    specialty: context?.dentist?.specialty?.trim() || '',
    orderNumber: settings.orderNumber?.trim() || '',
  }
}

function logoMarkup(settings: ClinicSettings, className: string) {
  if (settings.logo) {
    return `<img class="${className}" src="${escapeHtml(settings.logo)}" alt="" />`
  }
  return `<div class="${className} rx-e-logo-fallback">${DEFAULT_TOOTH_SVG}</div>`
}

function buildElegantPrescriptionHtml(
  rx: Prescription,
  settings: ClinicSettings,
  context?: PrescriptionPrintContext,
) {
  const patient = elegantPatient(rx, context)
  const practitioner = elegantPractitioner(rx, settings, context)
  const footerAr = settings.prescriptionFooterAr?.trim() || DEFAULT_RX_FOOTER_AR
  const meds = rx.lines.filter((l) => l.drug.trim())
  const lines = meds
    .map(
      (line, i) => `<article class="rx-e-med">
        <div class="rx-e-n">${i + 1}</div>
        <div>
          <p class="rx-e-name">${escapeHtml(line.drug)}</p>
          <p class="rx-e-posology">${escapeHtml(line.posology || '—')}</p>
          ${line.notes.trim() ? `<p class="rx-e-note">${escapeHtml(line.notes)}</p>` : ''}
        </div>
        <div class="rx-e-duration">${escapeHtml(line.duration || '—')}</div>
      </article>`,
    )
    .join('')

  const layoutCss = printEleganteCss.replace(/@import\s+url\([^)]+\)\s*;/g, '').trimStart()

  return `<!DOCTYPE html>
<html lang="fr" class="prescription-pdf" style="${PRINT_TEXT}">
<head>
  <meta charset="utf-8" />
  <title>Ordonnance — ${escapeHtml(rx.patientName)}</title>
  <style>
    ${embeddedFontCss()}
    @page { size: A4 portrait; margin: 0; }
    ${layoutCss}
  </style>
</head>
<body class="prescription-pdf" style="${PRINT_TEXT}">
  <div class="sheet sheet-elegante prescription-pdf" style="${PRINT_TEXT}">
    <header class="rx-e-header">
      <div class="rx-e-left">
        ${practitioner.arabic ? `<p class="rx-e-ar-name">${escapeHtml(practitioner.arabic)}</p>` : ''}
        ${practitioner.latin ? `<p class="rx-e-dr">${escapeHtml(practitioner.latin)}</p>` : ''}
        ${practitioner.specialty ? `<p class="rx-e-spec">${escapeHtml(practitioner.specialty)}</p>` : ''}
        ${practitioner.orderNumber ? `<p class="rx-e-order">N° d’ordre : ${escapeHtml(practitioner.orderNumber)}</p>` : ''}
      </div>
      <div class="rx-e-logo-wrap">${logoMarkup(settings, 'rx-e-logo')}</div>
      <div class="rx-e-right">
        <p><span class="lbl">Téléphone :</span> ${escapeHtml(patient.phone || '—')}</p>
        <p><span class="lbl">Nom :</span> ${escapeHtml(patient.lastName || '—')}</p>
        <p><span class="lbl">Prénom :</span> ${escapeHtml(patient.firstName || '—')}</p>
        <p><span class="lbl">Âge :</span> ${escapeHtml(patient.age || '—')}</p>
      </div>
    </header>
    <div class="rx-e-title">
      <span class="rx-e-title-line"></span>
      <h1>ORDONNANCE</h1>
      <span class="rx-e-title-line"></span>
    </div>
    <section class="rx-e-frame">
      <div class="rx-e-watermark" aria-hidden="true">${logoMarkup(settings, '')}</div>
      <div class="rx-e-body">
        ${lines || `<p class="rx-e-empty">Aucun médicament prescrit.</p>`}
        ${
          rx.advice.trim()
            ? `<div class="rx-e-advice"><strong>Conseils / remarques</strong><p>${escapeHtml(rx.advice).replace(/\n/g, '<br />')}</p></div>`
            : ''
        }
      </div>
    </section>
    <footer class="rx-e-footer">
      <p class="rx-e-wish">${escapeHtml(footerAr)}</p>
      <div class="rx-e-bottom">
        <p>TEL : ${escapeHtml(settings.phone || '—')}</p>
        <p class="addr">العنوان : ${escapeHtml(settings.address || '—')}</p>
      </div>
    </footer>
  </div>
</body>
</html>`
}

export function prescriptionPrintContextFromClinic(
  rx: Pick<Prescription, 'patientId' | 'dentistId'>,
  clinic: {
    patients: Patient[]
    dentists: Dentist[]
  },
): PrescriptionPrintContext {
  return {
    patient: rx.patientId ? clinic.patients.find((p) => p.id === rx.patientId) : undefined,
    dentist: rx.dentistId ? clinic.dentists.find((d) => d.id === rx.dentistId) : undefined,
  }
}
