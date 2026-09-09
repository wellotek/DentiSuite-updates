import type { ClinicSettings, Prescription } from '../types'
import { parseISODate } from './agenda'
import printCss from '../components/prescriptions/prescriptionPrint.css?raw'
import interLatin400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?inline'
import interLatin500 from '@fontsource/inter/files/inter-latin-500-normal.woff2?inline'
import interLatin600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?inline'
import interLatin700 from '@fontsource/inter/files/inter-latin-700-normal.woff2?inline'

const PRINT_FONT = "'Inter'"
const PRINT_TEXT =
  `font-family:${PRINT_FONT} !important;font-weight:400 !important;font-style:normal !important;font-synthesis:none !important;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision`

const PRINT_FACES = [
  { family: 'Inter', data: interLatin400 },
  { family: 'Inter Medium', data: interLatin500 },
  { family: 'Inter SemiBold', data: interLatin600 },
  { family: 'Inter Bold', data: interLatin700 },
] as const

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

export async function printPrescription(rx: Prescription, settings: ClinicSettings, locale = 'fr-DZ') {
  console.log('[PDF] Button clicked')
  console.log('[PDF] Starting print pipeline')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('title', 'Aperçu d’impression')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:1;visibility:visible;background:#fff;'
  document.body.appendChild(iframe)

  try {
    console.log('[PDF] Creating print document')
    const html = buildPrescriptionHtml(rx, settings, locale)
    console.log('[PDF] Injecting HTML/CSS')
    await new Promise<void>((resolve) => {
      let settled = false
      const done = (reason: string) => {
        if (settled) return
        settled = true
        console.log('[PDF] iframe ready via', reason)
        resolve()
      }
      const hasSheet = () => Boolean(iframe.contentDocument?.querySelector('.sheet'))
      iframe.onload = () => {
        if (hasSheet()) done('onload')
        else console.log('[PDF] iframe onload ignored (document empty)')
      }
      iframe.srcdoc = html
      if (hasSheet()) done('srcdoc-sync')
      window.setTimeout(() => done('timeout-800ms'), 800)
    })

    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    if (!doc || !win) {
      throw new Error('iframe.contentDocument / contentWindow unavailable')
    }
    console.log('[PDF] iframe loaded')

    await registerPrintFonts(doc)

    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      iframe.remove()
    }
    win.addEventListener('afterprint', cleanup, { once: true })
    window.setTimeout(cleanup, 60_000)

    console.log('[PDF] Calling print')
    win.focus()
    win.print()
    console.log('[PDF] Print completed')
  } catch (error) {
    logPdfError('Print failed', error)
    iframe.remove()
  }
}

function buildPrescriptionHtml(rx: Prescription, settings: ClinicSettings, locale: string) {
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
