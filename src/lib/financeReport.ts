import type { ClinicSettings, Invoice } from '../types'
import { formatDA } from './money'
import { filterInvoices, formatPeriodLabel, sumAmount, type FinancePeriod } from './finances'
import { parseISODate } from './agenda'
import {
  a4ReportBaseCss,
  clinicLogoHtml,
  escapeHtml,
  formatGeneratedLongFr,
  printHtmlViaIframe,
  wrapA4Document,
} from '../print'

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
  void printHtmlViaIframe({ html, mode: 'hidden' })
}

/** Exported for structure tests — visual markup preserved from legacy engine. */
export function buildFinanceReportHtml(
  invoices: Invoice[],
  settings: ClinicSettings,
  period: FinancePeriod,
  locale: string,
) {
  const generated = formatGeneratedLongFr()
  const paid = sumAmount(invoices, true)
  const unpaid = sumAmount(invoices, false)
  const total = paid + unpaid
  const periodLabel = formatPeriodLabel(period, locale)
  const modeLabel = period.mode === 'day' ? 'Jour' : period.mode === 'week' ? 'Semaine' : 'Période'
  const logo = clinicLogoHtml(settings)

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

  const css = `${a4ReportBaseCss('portrait')}
    .badge.paid { background: #d1fae5; color: #065f46; }
    .badge.billed { background: #ffedd5; color: #9a3412; }`

  const body = `
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
  </footer>`

  return wrapA4Document({
    title: 'Rapport financier — DentiSuite',
    css,
    body,
  })
}
