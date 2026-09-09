import type { Dentist } from '../../types'
import { dentistInitials, dentistName } from '../../lib/dentists'

export function DentistAvatar({
  dentist,
  size = 40,
}: {
  dentist?: Pick<Dentist, 'firstName' | 'lastName' | 'photo' | 'color'>
  size?: number
}) {
  if (!dentist) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-500"
        style={{ width: size, height: size }}
      >
        —
      </div>
    )
  }
  if (dentist.photo) {
    return (
      <img
        src={dentist.photo}
        alt=""
        className="rounded-full object-cover"
        style={{ width: size, height: size, boxShadow: `0 0 0 2px ${dentist.color}` }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-full text-xs font-bold text-white"
      style={{ width: size, height: size, background: dentist.color }}
    >
      {dentistInitials(dentist)}
    </div>
  )
}

export function DentistSelect({
  dentists,
  value,
  onChange,
  label,
  optionalLabel,
}: {
  dentists: Dentist[]
  value: string
  onChange: (id: string) => void
  label: string
  optionalLabel: string
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-clinic-400"
      >
        <option value="">{optionalLabel}</option>
        {dentists.map((d) => (
          <option key={d.id} value={d.id}>
            {dentistName(d)} — {d.specialty}
          </option>
        ))}
      </select>
    </label>
  )
}
