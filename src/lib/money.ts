export function formatDA(amount: number) {
  return `${new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 0 }).format(amount)} DA`
}

/** Convertit d’anciens montants type euro vers le dinar (approx. cabinet). */
export function toDZD(amount: number) {
  if (!Number.isFinite(amount)) return 0
  return amount < 1000 ? Math.round(amount * 50) : amount
}
