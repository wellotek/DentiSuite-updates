/**
 * Dashboard welcome line from the connected user profile + account role.
 * Never uses cabinet name or the dentists directory.
 */

export type WelcomePerson = {
  firstName: string
  lastName: string
  /** True when the account role is a practitioner (dentist / doctor). */
  isDoctor: boolean
}

/** Strip a leading « Dr. » so we never render « Dr. Dr. … ». */
function stripDoctorPrefix(value: string): string {
  return value.replace(/^dr\.?\s+/i, '').trim()
}

/** Split a full display name into first + last (first token / rest). */
export function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = stripDoctorPrefix(fullName)
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') }
}

/**
 * True only for practitioner account roles.
 * DentiSuite Cloud membership roles are ADMIN | ASSISTANT (no separate DENTIST enum):
 * ADMIN = practitioner/owner account → Dr.
 * ASSISTANT = non-practitioner → no Dr.
 * Also accepts explicit dentist/doctor/praticien labels if present on the role string.
 */
export function roleGrantsDoctorTitle(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (r === 'assistant') return false

  if (
    r === 'dentiste' ||
    r === 'dentist' ||
    r === 'medecin' ||
    r === 'doctor' ||
    r === 'praticien' ||
    r === 'practitioner'
  ) {
    return true
  }

  // Real Cloud role for the clinic practitioner account
  if (r === 'admin' || r === 'administrateur') return true

  return false
}

/**
 * Resolve prénom / nom from the user profile (never cabinet settings.name).
 */
export function resolveWelcomePerson(input: {
  firstName?: string | null
  lastName?: string | null
  displayName?: string | null
  username?: string | null
  role?: string | null
}): WelcomePerson {
  let firstName = input.firstName?.trim() || ''
  let lastName = input.lastName?.trim() || ''

  if (!firstName && !lastName && input.displayName?.trim()) {
    const split = splitDisplayName(input.displayName.trim())
    firstName = split.firstName
    lastName = split.lastName
  }

  if (!firstName && !lastName && input.username?.trim()) {
    // Username is a login handle, not a civil name — use only if nothing else exists
    firstName = stripDoctorPrefix(input.username.trim())
    lastName = ''
  }

  return {
    firstName,
    lastName,
    isDoctor: roleGrantsDoctorTitle(input.role),
  }
}

export function welcomeGreeting(person: WelcomePerson): string {
  const full = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  if (!full) return 'Bonjour'
  if (person.isDoctor) return `Bonjour Dr. ${full}`
  return `Bonjour ${full}`
}
