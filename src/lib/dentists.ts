import type { Dentist } from '../types'

export function dentistName(d: Pick<Dentist, 'firstName' | 'lastName'>) {
  return `Dr. ${d.firstName} ${d.lastName}`
}

export function dentistInitials(d: Pick<Dentist, 'firstName' | 'lastName'>) {
  return `${d.firstName.charAt(0)}${d.lastName.charAt(0)}`.toUpperCase()
}

export const DENTIST_COLORS = ['#0e628e', '#059669', '#7c3aed', '#dc2626', '#d97706', '#0891b3', '#be185d', '#4338ca']
