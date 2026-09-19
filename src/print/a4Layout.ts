import type { ClinicSettings } from '../types'
import { escapeHtml } from './escapeHtml'

/** Clinic logo or lettermark fallback used by finance/stock reports. */
export function clinicLogoHtml(settings: ClinicSettings, sizePx = 52): string {
  if (settings.logo) {
    return `<img src="${escapeHtml(settings.logo)}" alt="" style="width:${sizePx}px;height:${sizePx}px;border-radius:12px;object-fit:cover;" />`
  }
  return `<div style="width:${sizePx}px;height:${sizePx}px;border-radius:12px;background:linear-gradient(135deg,#3d96c0,#0c4f73);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">D</div>`
}

export function formatGeneratedLongFr(date = new Date()): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Shared A4 report chrome styles (finance portrait / stock landscape). */
export function a4ReportBaseCss(orientation: 'portrait' | 'landscape'): string {
  return `
    @page { size: A4 ${orientation}; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0e628e; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0b3d5c; }
    .muted { color: #64748b; font-size: 12px; }
    .kpis { display: flex; gap: 12px; margin: 0 0 16px; }
    .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .kpi b { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: ${orientation === 'landscape' ? '11px' : '12px'}; }
    th { text-align: left; background: #0e628e; color: #fff; padding: 8px; font-weight: 600; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    footer { margin-top: 18px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  `.trim()
}

export function wrapA4Document(opts: {
  lang?: string
  title: string
  css: string
  body: string
}): string {
  return `<!DOCTYPE html>
<html lang="${opts.lang ?? 'fr'}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(opts.title)}</title>
  <style>
${opts.css}
  </style>
</head>
<body>
${opts.body}
</body>
</html>`
}
