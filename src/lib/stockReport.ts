import type { ClinicSettings, StockItem } from '../types'
import { formatDA } from './money'
import { formatStockDate, stockAlert, stockAlertMeta, stockCategoryLabel, stockValue } from './stock'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function printStockReport(items: StockItem[], settings: ClinicSettings) {
  const html = buildStockReportHtml(items, settings)
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

function buildStockReportHtml(items: StockItem[], settings: ClinicSettings) {
  const today = new Date()
  const generated = today.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const totalValue = items.reduce((sum, item) => sum + stockValue(item), 0)
  const expired = items.filter((i) => stockAlert(i) === 'expired')
  const low = items.filter((i) => stockAlert(i) === 'low')
  const expiring = items.filter((i) => stockAlert(i) === 'expiring')
  const logo = settings.logo
    ? `<img src="${escapeHtml(settings.logo)}" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover;" />`
    : `<div style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3d96c0,#0c4f73);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">D</div>`

  const rows = items
    .map((item) => {
      const alert = stockAlert(item)
      const meta = stockAlertMeta(alert)
      const bg = alert === 'expired' || alert === 'low' ? '#fef2f2' : alert === 'expiring' ? '#fff7ed' : '#ffffff'
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

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Inventaire stock — DentiSuite</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; margin: 0; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0e628e; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #0b3d5c; }
    .muted { color: #64748b; font-size: 12px; }
    .kpis { display: flex; gap: 12px; margin: 0 0 16px; }
    .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .kpi b { display: block; font-size: 18px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { text-align: left; background: #0e628e; color: #fff; padding: 8px; font-weight: 600; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.low, .badge.expired { background: #fee2e2; color: #991b1b; }
    .badge.expiring { background: #ffedd5; color: #9a3412; }
    .renew { margin-top: 16px; }
    footer { margin-top: 18px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
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
  </footer>
</body>
</html>`
}
