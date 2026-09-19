/** Age helpers — birthDate (YYYY-MM-DD) is source of truth when present. */

export function parseBirthDate(iso: string | null | undefined): Date | null {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null
  }
  return dt
}

/** Whole years completed as of `asOf` (default today, local calendar). */
export function computeAgeFromBirthDate(
  birthDate: string | null | undefined,
  asOf: Date = new Date(),
): number | null {
  const born = parseBirthDate(birthDate)
  if (!born) return null
  let age = asOf.getFullYear() - born.getUTCFullYear()
  const month = asOf.getMonth() - born.getUTCMonth()
  if (month < 0 || (month === 0 && asOf.getDate() < born.getUTCDate())) {
    age -= 1
  }
  if (age < 0 || age > 150) return null
  return age
}

/** Prefer live age from birthDate; fall back to stored integer age. */
export function displayAge(patient: {
  birthDate?: string | null
  age: number
}): number {
  const computed = computeAgeFromBirthDate(patient.birthDate)
  if (computed !== null) return computed
  return Number.isFinite(patient.age) ? patient.age : 0
}

export function formatBirthDateFr(birthDate: string | null | undefined): string {
  const born = parseBirthDate(birthDate)
  if (!born) return ''
  const dd = String(born.getUTCDate()).padStart(2, '0')
  const mm = String(born.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = born.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function patientIdentityLines(patient: {
  firstName: string
  lastName: string
  birthDate?: string | null
  age: number
}): { fullName: string; birthLine: string | null; ageLine: string } {
  const fullName = `${patient.firstName} ${patient.lastName}`.trim()
  const birthFr = formatBirthDateFr(patient.birthDate)
  const age = displayAge(patient)
  return {
    fullName,
    birthLine: birthFr ? `Né(e) le : ${birthFr}` : null,
    ageLine: `Âge : ${age} ans`,
  }
}
