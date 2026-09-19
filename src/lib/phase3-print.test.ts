import { describe, expect, it } from 'vitest'
import { escapeHtml, a4ReportBaseCss, wrapA4Document, clinicLogoHtml } from '../print'
import { buildFinanceReportHtml } from './financeReport'
import { buildStockReportHtml } from './stockReport'
import { buildPrescriptionHtml } from './prescriptionReport'
import { estimateHydrateRequestCount } from './hydrateCost'
import type { ClinicSettings, Invoice, Prescription, StockItem } from '../types'

const settings: ClinicSettings = {
  name: 'Cabinet Test',
  address: '1 rue de la Santé',
  phone: '0555000000',
  email: 'cabinet@example.com',
  logo: '',
  adminPhoto: '',
  locale: 'fr',
  timezone: 'Africa/Algiers',
  dateFormat: 'long',
  timeFormat: '24h',
}

describe('phase3 shared A4 print engine', () => {
  it('escapeHtml sanitizes markup', () => {
    expect(escapeHtml(`<script>"x"&y`)).toBe('&lt;script&gt;&quot;x&quot;&amp;y')
  })

  it('wrapA4Document emits A4 CSS orientation', () => {
    const html = wrapA4Document({
      title: 'Doc',
      css: a4ReportBaseCss('portrait'),
      body: '<p>ok</p>',
    })
    expect(html).toContain('@page { size: A4 portrait')
    expect(html).toContain('<p>ok</p>')
    expect(clinicLogoHtml(settings)).toContain('D</div>')
  })

  it('finance report keeps header patient table totals footer', () => {
    const invoices: Invoice[] = [
      {
        id: 'i1',
        patientId: 'p1',
        patientName: 'Jean Dupont',
        label: 'Soins',
        amount: 2500,
        paid: true,
        date: '2026-09-10',
      },
      {
        id: 'i2',
        patientName: 'Walk In',
        label: 'Consult',
        amount: 1000,
        paid: false,
        date: '2026-09-11',
      },
    ]
    const html = buildFinanceReportHtml(
      invoices,
      settings,
      { mode: 'day', start: '2026-09-01', end: '2026-09-30', cursor: '2026-09-15' },
      'fr-DZ',
    )
    expect(html).toContain('Rapport financier')
    expect(html).toContain('Jean Dupont')
    expect(html).toContain('Cabinet Test')
    expect(html).toContain('Document interne')
    expect(html).toContain('@page { size: A4 portrait')
    expect(html).toContain('Payé')
    expect(html).toContain('Facturé')
  })

  it('stock report keeps landscape A4 and inventory columns', () => {
    const items: StockItem[] = [
      {
        id: 's1',
        code: 'ART-1',
        name: 'Gants',
        category: 'consommable',
        quantity: 10,
        minQuantity: 5,
        unitPrice: 100,
        addedAt: '2026-01-01',
        expiryDate: '2027-01-01',
        supplier: 'Fournisseur',
      },
    ]
    const html = buildStockReportHtml(items, settings)
    expect(html).toContain('Inventaire du stock')
    expect(html).toContain('@page { size: A4 landscape')
    expect(html).toContain('ART-1')
    expect(html).toContain('Gants')
    expect(html).toContain('Document interne')
  })

  it('prescription report keeps patient meds signature sheet', () => {
    const rx: Prescription = {
      id: 'rx1',
      patientId: 'p1',
      patientName: 'Jean Dupont',
      patientBirthDate: '1984-03-15',
      patientAge: 42,
      date: '2026-09-12',
      title: 'Ordonnance type',
      lines: [
        { id: 'l1', drug: 'Amoxicilline', posology: '2/j', duration: '7j', notes: '' },
      ],
      advice: 'Boire beaucoup d’eau',
      dentistName: 'Dr Test',
    }
    const html = buildPrescriptionHtml(rx, settings, 'fr-DZ')
    expect(html).toContain('ORDONNANCE')
    expect(html).toContain('Jean Dupont')
    expect(html).toContain('Amoxicilline')
    expect(html).toContain('class="sheet')
    expect(html).toContain('Cachet et signature')
    expect(html).toContain('Cabinet Test')
  })
})

describe('phase3 hydrate cost model (legacy N+1 reference)', () => {
  it('scales as 6 + 4N requests for single-page lists in n+1 mode', () => {
    expect(estimateHydrateRequestCount({ patientCount: 10, bulk: false }).totalHttpRequests).toBe(6 + 40)
    expect(estimateHydrateRequestCount({ patientCount: 100, bulk: false }).totalHttpRequests).toBe(6 + 400)
    expect(estimateHydrateRequestCount({ patientCount: 500, bulk: false }).totalHttpRequests).toBe(6 + 2000)
    expect(estimateHydrateRequestCount({ patientCount: 100, bulk: false }).estimatedSequentialRounds).toBe(100)
  })
})

describe('phase4 hydrate cost model (bulk)', () => {
  it('is independent of patient count for single-page lists', () => {
    expect(estimateHydrateRequestCount({ patientCount: 10 }).totalHttpRequests).toBe(10)
    expect(estimateHydrateRequestCount({ patientCount: 100 }).totalHttpRequests).toBe(10)
    expect(estimateHydrateRequestCount({ patientCount: 500 }).totalHttpRequests).toBe(10)
    expect(estimateHydrateRequestCount({ patientCount: 100 }).mode).toBe('bulk')
  })
})
