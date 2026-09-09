import type { StockAlert, StockCategory, StockItem } from '../types'
import { addDays, parseISODate, toISODate } from './agenda'

export const EXPIRY_WARNING_DAYS = 30

export const STOCK_CATEGORIES: { id: StockCategory; label: string }[] = [
  { id: 'consommable', label: 'Consommable' },
  { id: 'prothese', label: 'Prothèse' },
  { id: 'hygiene', label: 'Hygiène' },
  { id: 'medicament', label: 'Médicament' },
]

export function stockCategoryLabel(category: StockCategory) {
  return STOCK_CATEGORIES.find((c) => c.id === category)?.label ?? category
}

export function stockAlert(item: StockItem, today = toISODate(new Date())): StockAlert {
  if (item.expiryDate && item.expiryDate < today) return 'expired'
  if (item.quantity <= item.minQuantity) return 'low'
  if (item.expiryDate) {
    const limit = toISODate(addDays(parseISODate(today), EXPIRY_WARNING_DAYS))
    if (item.expiryDate <= limit) return 'expiring'
  }
  return 'ok'
}

export function stockAlertMeta(alert: StockAlert) {
  if (alert === 'expired') {
    return { label: 'Périmé', className: 'bg-red-100 text-red-800 ring-1 ring-red-200' }
  }
  if (alert === 'low') {
    return { label: 'Stock bas', className: 'bg-red-100 text-red-800 ring-1 ring-red-200' }
  }
  if (alert === 'expiring') {
    return { label: 'À renouveler', className: 'bg-orange-100 text-orange-800 ring-1 ring-orange-200' }
  }
  return { label: 'OK', className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200' }
}

export function stockValue(item: StockItem) {
  return item.quantity * item.unitPrice
}

export function formatStockDate(iso: string) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR')
}

export const defaultStockItems: StockItem[] = [
  {
    id: 'st1',
    code: 'COMP-A2',
    name: 'Composite nano-hybride A2',
    category: 'consommable',
    quantity: 4,
    minQuantity: 6,
    unitPrice: 8500,
    addedAt: '2026-03-12',
    expiryDate: '2027-02-15',
    supplier: 'Dental Algérie',
  },
  {
    id: 'st2',
    code: 'GNT-100',
    name: 'Gants nitrile (boîte 100)',
    category: 'hygiene',
    quantity: 22,
    minQuantity: 8,
    unitPrice: 1200,
    addedAt: '2026-06-01',
    expiryDate: '2028-01-01',
    supplier: 'Hygia Médical',
  },
  {
    id: 'st3',
    code: 'ART-40',
    name: 'Cartouches articaine 4%',
    category: 'medicament',
    quantity: 9,
    minQuantity: 12,
    unitPrice: 450,
    addedAt: '2026-01-20',
    expiryDate: '2026-09-08',
    supplier: 'Pharma Dent',
  },
  {
    id: 'st4',
    code: 'CRN-TMP',
    name: 'Couronnes provisoires PMMA',
    category: 'prothese',
    quantity: 18,
    minQuantity: 6,
    unitPrice: 2200,
    addedAt: '2025-11-04',
    expiryDate: '2026-07-10',
    supplier: 'Laboratoire Atlas',
  },
  {
    id: 'st5',
    code: 'BCH-250',
    name: 'Bain de bouche chlorhexidine 0,12%',
    category: 'hygiene',
    quantity: 14,
    minQuantity: 5,
    unitPrice: 950,
    addedAt: '2026-05-18',
    expiryDate: '2026-09-12',
    supplier: 'Hygia Médical',
  },
  {
    id: 'st6',
    code: 'ALG-454',
    name: 'Alginate empreinte 454 g',
    category: 'consommable',
    quantity: 11,
    minQuantity: 4,
    unitPrice: 2800,
    addedAt: '2026-04-02',
    expiryDate: '2027-06-30',
    supplier: 'Dental Algérie',
  },
  {
    id: 'st7',
    code: 'SUT-4/0',
    name: 'Fil de suture 4/0',
    category: 'consommable',
    quantity: 2,
    minQuantity: 6,
    unitPrice: 600,
    addedAt: '2026-02-11',
    expiryDate: '2027-11-01',
    supplier: 'Pharma Dent',
  },
  {
    id: 'st8',
    code: 'CIV-10',
    name: 'Ciment verre ionomère',
    category: 'consommable',
    quantity: 7,
    minQuantity: 3,
    unitPrice: 5200,
    addedAt: '2026-07-22',
    expiryDate: '2028-04-01',
    supplier: 'Dental Algérie',
  },
  {
    id: 'st9',
    code: 'MSK-50',
    name: 'Masques chirurgicaux (boîte 50)',
    category: 'hygiene',
    quantity: 16,
    minQuantity: 6,
    unitPrice: 700,
    addedAt: '2026-08-01',
    expiryDate: '2029-01-01',
    supplier: 'Hygia Médical',
  },
  {
    id: 'st10',
    code: 'DNT-RES',
    name: 'Dents en résine (coffret)',
    category: 'prothese',
    quantity: 5,
    minQuantity: 2,
    unitPrice: 14500,
    addedAt: '2026-06-15',
    expiryDate: '',
    supplier: 'Céramilab',
  },
]
