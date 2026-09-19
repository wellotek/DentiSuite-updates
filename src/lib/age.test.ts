import { describe, expect, it } from 'vitest'
import { computeAgeFromBirthDate, displayAge, formatBirthDateFr } from './age'

describe('age helpers', () => {
  it('computes age from birthDate', () => {
    const age = computeAgeFromBirthDate('1990-06-15', new Date('2026-09-13'))
    expect(age).toBe(36)
  })

  it('handles birthday not yet reached this year', () => {
    const age = computeAgeFromBirthDate('1990-12-01', new Date('2026-09-13'))
    expect(age).toBe(35)
  })

  it('prefers birthDate over stored age', () => {
    expect(displayAge({ birthDate: '1990-06-15', age: 99 })).toBe(
      computeAgeFromBirthDate('1990-06-15')!,
    )
  })

  it('falls back to stored age without birthDate', () => {
    expect(displayAge({ age: 42 })).toBe(42)
  })

  it('formats FR birth date', () => {
    expect(formatBirthDateFr('1990-06-15')).toBe('15/06/1990')
  })
})
