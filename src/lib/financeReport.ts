import type { ClinicSettings, Invoice } from '../types'
import { formatDA } from './money'
import { filterInvoices, formatPeriodLabel, sumAmount, type FinancePeriod } from './finances'
import { parseISODate } from './agenda'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printFinanceReport(
  invoices: Invoice[],
  settings: ClinicSettings,
  period: FinancePeriod,
  locale: string,
) {
  const rows = [...filterInvoices(invoices, period.start, period.end)].sort(
    (a, b) => b.date.localeCompare(a.date) || a.patientName.localeCompare(b.patientName),
  )
  const html = buildFinanceReportHtml(rows, settings, period, locale)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => iframe.remove(), 1000)
  }, 350)
}

function buildFinanceReportHtml(
  invoices: Invoice[],
  settings: ClinicSettings,
  period: FinancePeriod,
  locale: string,
) {
  const today = new Date()
  const generated = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const paid = sumAmount(invoices, true)
  const unpaid = sumAmount(invoices, false)
  const total = paid + unpaid
  const periodLabel = formatPeriodLabel(period, locale)
  const modeLabel = period.mode === 'day' ? 'Jour' : period.mode === 'week' ? 'Semaine' : 'Période'
  const logo = settings.logo
    ? `<img src="${escapeHtml(settings.logo)}" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover;" />`
    : `<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3d96c0,#0c4f73);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">D</div>`

  const rows = invoices
    .map((inv) => {
      const date = parseISODate(inv.date).toLocaleDateString('fr-FR')
      return `<tr>
        <td>${escapeHtml(date)}</td>
        <td><strong>${escapeHtml(inv.patientName)}</strong></td>
        <td>${escapeHtml(inv.label)}</td>
        <td style="text-align:right;">${escapeHtml(formatDA(inv.amount))}</td>
        <td><span class="badge ${inv.paid ? 'paid' : 'billed'}">${inv.paid ? 'Payé' : 'Facturé'}</span></td>
      </tr>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Rapport financier — DentiSuite</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0e628e; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0b3d5c; }
    .muted { color: #64748b; font-size: 12px; }
    .kpis { display: flex; gap: 12px; margin: 0 0 16px; }
    .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .kpi b { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #0e628e; color: #fff; padding: 8px; font-weight: 600; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge.paid { background: #d1fae5; color: #065f46; }
    .badge.billed { background: #ffedd5; color: #9a3412; }
    footer { margin-top: 18px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <header>
    <div style="display:flex;gap:12px;align-items:center;">
      ${logo}
      <div>
        <h1>Rapport financier — ${escapeHtml(modeLabel)}</h1>
        <div class="muted">${escapeHtml(settings.name)} — ${escapeHtml(settings.address)}</div>
        <div class="muted">${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</div>
      </div>
    </div>
    <div class="muted" style="text-align:right;">
      <div style="font-weight:700;color:#0e628e;">DentiSuite</div>
      ${escapeHtml(periodLabel)}<br />
      Généré le ${escapeHtml(generated)}
    </div>
  </header>
  <div class="kpis">
    <div class="kpi">Transactions<br><b>${invoices.length}</b></div>
    <div class="kpi">Chiffre d'affaires (payé)<br><b>${escapeHtml(formatDA(paid))}</b></div>
    <div class="kpi">Facturé / impayé<br><b style="color:#c2410c;">${escapeHtml(formatDA(unpaid))}</b></div>
    <div class="kpi">Volume total<br><b>${escapeHtml(formatDA(total))}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Patient</th><th>Libellé / Acte</th><th>Montant</th><th>Statut</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5">Aucune transaction sur cette période.</td></tr>`}</tbody>
  </table>
  <footer>
    <span>Document interne — ${escapeHtml(settings.name)}</span>
    <span>DentiSuite · Caisse &amp; Finances · Montants en DA</span>
  </footer>
</body>
</html>`
}
