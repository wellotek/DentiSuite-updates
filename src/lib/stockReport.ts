import type { ClinicSettings, StockItem } from '../types'
import { formatDA } from './money'
import { formatStockDate, stockAlert, stockAlertMeta, stockCategoryLabel, stockValue } from './stock'
import {
  a4ReportBaseCss,
  clinicLogoHtml,
  escapeHtml,
  formatGeneratedLongFr,
  printHtmlViaIframe,
  wrapA4Document,
} from '../print'

export function printStockReport(items: StockItem[], settings: ClinicSettings) {
  const html = buildStockReportHtml(items, settings)
  void printHtmlViaIframe({ html, mode: 'hidden' })
}

/** Exported for structure tests — visual markup preserved from legacy engine. */
export function buildStockReportHtml(items: StockItem[], settings: ClinicSettings) {
  const generated = formatGeneratedLongFr()
  const totalValue = items.reduce((sum, item) => sum + stockValue(item), 0)
  const expired = items.filter((i) => stockAlert(i) === 'expired')
  const low = items.filter((i) => stockAlert(i) === 'low')
  const expiring = items.filter((i) => stockAlert(i) === 'expiring')
  const logo = clinicLogoHtml(settings)

  const rows = items
    .map((item) => {
      const alert = stockAlert(item)
      const meta = stockAlertMeta(alert)
      const bg =
        alert === 'expired' || alert === 'low' ? '#fef2f2' : alert === 'expiring' ? '#fff7ed' : '#ffffff'
      return `<tr style="background:${bg};">
        <td>${escapeHtml(item.code)}</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(stockCategoryLabel(item.category))}</td>
        <td style="text-align:right;">${item.quantity}</td>
        <td style="text-align:right;">${escapeHtml(formatDA(item.unitPrice))}</td>
        <td style="text-align:right;">${escapeHtml(formatDA(stockValue(item)))}</td>
        <td>${escapeHtml(formatStockDate(item.expiryDate))}</td>
        <td>${escapeHtml(item.supplier)}</td>
        <td><span class="badge ${alert}">${escapeHtml(meta.label)}</span></td>
      </tr>`
    })
    .join('')

  const renewList = [...expired, ...low, ...expiring]
    .map((item) => {
      const meta = stockAlertMeta(stockAlert(item))
      return `<li><strong>${escapeHtml(item.code)}</strong> — ${escapeHtml(item.name)} <em>(${escapeHtml(meta.label)})</em></li>`
    })
    .join('')

  const css = `${a4ReportBaseCss('landscape')}
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.low, .badge.expired { background: #fee2e2; color: #991b1b; }
    .badge.expiring { background: #ffedd5; color: #9a3412; }
    .renew { margin-top: 16px; }`

  const body = `
  <header>
    <div style="display:flex;gap:12px;align-items:center;">
      ${logo}
      <div>
        <h1>Inventaire du stock</h1>
        <div class="muted">${escapeHtml(settings.name)} — ${escapeHtml(settings.address)}</div>
        <div class="muted">${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}</div>
      </div>
    </div>
    <div class="muted" style="text-align:right;">
      <div style="font-weight:700;color:#0e628e;">DentiSuite</div>
      Généré le ${escapeHtml(generated)}
    </div>
  </header>
  <div class="kpis">
    <div class="kpi">Articles<br><b>${items.length}</b></div>
    <div class="kpi">Valeur d’inventaire<br><b>${escapeHtml(formatDA(totalValue))}</b></div>
    <div class="kpi">Périmés<br><b style="color:#b91c1c;">${expired.length}</b></div>
    <div class="kpi">Stock bas<br><b style="color:#b91c1c;">${low.length}</b></div>
    <div class="kpi">À renouveler (&lt; 30 j)<br><b style="color:#c2410c;">${expiring.length}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Réf.</th><th>Article</th><th>Catégorie</th><th>Qté</th>
        <th>P.U.</th><th>Valeur</th><th>Péremption</th><th>Fournisseur</th><th>Statut</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="9">Aucun article.</td></tr>`}</tbody>
  </table>
  <div class="renew">
    <h2 style="font-size:14px;margin:0 0 8px;color:#0b3d5c;">Produits expirés / à renouveler</h2>
    ${renewList ? `<ul>${renewList}</ul>` : `<p class="muted">Aucun article critique à cette date.</p>`}
  </div>
  <footer>
    <span>Document interne — ${escapeHtml(settings.name)}</span>
    <span>DentiSuite · Gestion de stock</span>
  </footer>`

  return wrapA4Document({
    title: 'Inventaire stock — DentiSuite',
    css,
    body,
  })
}
