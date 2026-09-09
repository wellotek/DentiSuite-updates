import type { ToothRecord, ToothStatus } from '../../types'
import { LOWER_TEETH, statusMeta, TOOTH_STATUSES, toothKind, toothLabel, UPPER_TEETH, type ToothKind } from '../../data/teeth'

interface OdontogramProps {
  teeth: Record<string, ToothRecord>
  selectedTeeth: string[]
  onToggleTooth: (tooth: string) => void
  onClearSelection?: () => void
}

const FILL: Record<ToothStatus, { fill: string; stroke: string; number: string }> = {
  saine: { fill: '#f4efe6', stroke: '#8a7760', number: '#1e293b' },
  carie: { fill: '#ef4444', stroke: '#991b1b', number: '#ffffff' },
  a_traiter: { fill: '#f87171', stroke: '#b91c1c', number: '#ffffff' },
  a_surveiller: { fill: '#fb923c', stroke: '#c2410c', number: '#ffffff' },
  traitee: { fill: '#10b981', stroke: '#047857', number: '#ffffff' },
  obturation: { fill: '#059669', stroke: '#065f46', number: '#ffffff' },
  couronne: { fill: '#fbbf24', stroke: '#b45309', number: '#422006' },
  facette: { fill: '#38bdf8', stroke: '#0369a1', number: '#0c4a6e' },
  implant: { fill: '#14b8a6', stroke: '#0f766e', number: '#ffffff' },
  extraction: { fill: '#cbd5e1', stroke: '#64748b', number: '#334155' },
}

export function Odontogram({ teeth, selectedTeeth, onToggleTooth, onClearSelection }: OdontogramProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Schéma dentaire</h2>
          <p className="text-xs text-slate-500">
            Arcade vue de dessus — formes anatomiques FDI.
            {selectedTeeth.length > 0 && (
              <span className="ms-2 font-semibold text-clinic-800">
                {selectedTeeth.length} dent{selectedTeeth.length > 1 ? 's' : ''} : {selectedTeeth.join(', ')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Legend />
          {selectedTeeth.length > 0 && onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs font-medium text-slate-500 hover:text-clinic-800"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-b from-slate-50 to-white px-2 py-3">
        <p className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">Arcade supérieure</p>
        <svg viewBox="0 0 800 560" className="mx-auto block w-full max-w-[720px]" role="img" aria-label="Odontogramme FDI">
          <text x="56" y="24" className="fill-slate-400" fontSize="11">
            Droite du patient
          </text>
          <text x="744" y="24" textAnchor="end" className="fill-slate-400" fontSize="11">
            Gauche du patient
          </text>
          <line x1="400" y1="32" x2="400" y2="528" stroke="#e2e8f0" strokeDasharray="4 6" />

          <path
            d="M78,58 C78,58 120,210 400,218 C680,210 722,58 722,58"
            fill="none"
            stroke="#e8e0d4"
            strokeWidth="38"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M78,502 C78,502 120,350 400,342 C680,350 722,502 722,502"
            fill="none"
            stroke="#e8e0d4"
            strokeWidth="38"
            strokeLinecap="round"
            opacity="0.55"
          />

          {UPPER_TEETH.map((n, i) => (
            <PlacedTooth
              key={n}
              number={n}
              index={i}
              arch="upper"
              record={teeth[n]}
              selected={selectedTeeth.includes(n)}
              onToggle={onToggleTooth}
            />
          ))}
          <text x="400" y="286" textAnchor="middle" className="fill-slate-300" fontSize="10" letterSpacing="3">
            OCCLUSION
          </text>
          {LOWER_TEETH.map((n, i) => (
            <PlacedTooth
              key={n}
              number={n}
              index={i}
              arch="lower"
              record={teeth[n]}
              selected={selectedTeeth.includes(n)}
              onToggle={onToggleTooth}
            />
          ))}
        </svg>
        <p className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">Arcade inférieure</p>
      </div>
    </div>
  )
}

function PlacedTooth({
  number,
  index,
  arch,
  record,
  selected,
  onToggle,
}: {
  number: string
  index: number
  arch: 'upper' | 'lower'
  record?: ToothRecord
  selected: boolean
  onToggle: (n: string) => void
}) {
  const { x, y, rot } = archPosition(index, arch)
  const kind = toothKind(number)
  const status = record?.status ?? 'saine'
  const colors = FILL[status]
  const meta = statusMeta(status)
  const extracted = status === 'extraction'
  const scale = toothScale(number, kind)

  return (
    <g
      role="button"
      tabIndex={0}
      onClick={() => onToggle(number)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(number)
        }
      }}
      className="cursor-pointer outline-none"
    >
      <title>{`${number} — ${toothLabel(number)} (${meta.label})`}</title>
      <circle cx={x} cy={y} r="26" fill="transparent" />
      <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
        {selected && (
          <ellipse
            rx={kind === 'molar' ? 22 : kind === 'premolar' || kind === 'incisor' ? 18 : 14}
            ry={kind === 'molar' ? 20 : 22}
            fill="none"
            stroke="#0e628e"
            strokeWidth="3.2"
          />
        )}
        <ToothShape kind={kind} fill={colors.fill} stroke={colors.stroke} extracted={extracted} />
      </g>
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="800"
        fill={colors.number}
        stroke={colors.number === '#ffffff' ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.85)'}
        strokeWidth="3"
        paintOrder="stroke"
        style={{ pointerEvents: 'none' }}
      >
        {number}
      </text>
    </g>
  )
}

function toothScale(number: string, kind: ToothKind) {
  if (kind === 'molar') return number.endsWith('8') ? 0.92 : 1.05
  if (kind === 'premolar') return 0.9
  if (kind === 'canine') return 0.88
  return number.endsWith('1') ? 1.02 : 0.94
}

function archPosition(index: number, arch: 'upper' | 'lower') {
  const t = index / 15
  if (arch === 'upper') {
    const deg = 200 + (-20 - 200) * t
    const rad = (deg * Math.PI) / 180
    return {
      x: 400 + 340 * Math.cos(rad),
      y: 95 + 125 * Math.sin(rad),
      rot: deg + 90,
    }
  }
  const deg = 160 + (380 - 160) * t
  const rad = (deg * Math.PI) / 180
  return {
    x: 400 + 340 * Math.cos(rad),
    y: 465 + 125 * Math.sin(rad),
    rot: deg + 90,
  }
}

function ToothShape({
  kind,
  fill,
  stroke,
  extracted,
}: {
  kind: ToothKind
  fill: string
  stroke: string
  extracted: boolean
}) {
  const opacity = extracted ? 0.42 : 1
  return (
    <g opacity={opacity}>
      {kind === 'incisor' && (
        <path
          d="M-11.8,-15 L-10.4,-17.2 H10.4 L11.8,-15 L12.2,12.8 C12.2,16.8 7.2,19.2 0,19.2 C-7.2,19.2 -12.2,16.8 -12.2,12.8 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
      {kind === 'canine' && (
        <path
          d="M0,-21 L4.2,-9 C7.8,-4 8.6,4 7.4,12 C5.8,17.5 2.6,19.5 0,19.5 C-2.6,19.5 -5.8,17.5 -7.4,12 C-8.6,4 -7.8,-4 -4.2,-9 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      )}
      {kind === 'premolar' && (
        <>
          <path
            d="M-12,-6 C-13,-13 -7,-18 0,-18 C7,-18 13,-13 12,-6 C13.5,2 12.5,11 8,16 C4,19.5 -4,19.5 -8,16 C-12.5,11 -13.5,2 -12,-6 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.7"
          />
          <path d="M-5.5,-11 C-2.5,-15 2.5,-15 5.5,-11" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
          <path d="M0,-12 V12" fill="none" stroke={stroke} strokeWidth="1" opacity="0.35" />
        </>
      )}
      {kind === 'molar' && (
        <>
          <path
            d="M-16,-11 C-17,-16.5 -11,-20.5 -4,-20.5 H4 C11,-20.5 17,-16.5 16,-11 C18.5,-4 18.5,8 15,14.5 C10,19.5 -10,19.5 -15,14.5 C-18.5,8 -18.5,-4 -16,-11 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.8"
          />
          <path d="M-8.5,-11 C-5,-15 0,-15 0,-10 C0,-15 5,-15 8.5,-11" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
          <path d="M-9.5,7 C-4,12 4,12 9.5,7" fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.55" />
          <path d="M0,-13 V14 M-12,0 H12" fill="none" stroke={stroke} strokeWidth="1" opacity="0.32" />
        </>
      )}
      {extracted && (
        <g stroke={stroke} strokeWidth="2.2" strokeLinecap="round">
          <line x1="-11" y1="-11" x2="11" y2="11" />
          <line x1="11" y1="-11" x2="-11" y2="11" />
        </g>
      )}
    </g>
  )
}

function Legend() {
  const items = TOOTH_STATUSES.filter((s) =>
    ['saine', 'carie', 'traitee', 'couronne', 'extraction'].includes(s.id),
  )
  return (
    <ul className="hidden flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:flex">
      {items.map((s) => (
        <li key={s.id} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${s.swatch}`} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}
