import { useMemo, useState } from 'react'
import { formatDA } from '../../lib/money'

export interface ChartPoint {
  label: string
  value: number
  visits: number
}

interface Props {
  points: ChartPoint[]
}

export function RevenueChart({ points }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 720
  const height = 248
  const pad = { l: 44, r: 16, t: 20, b: 36 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...points.map((p) => p.value))
  const coords = useMemo(
    () =>
      points.map((p, i) => {
        const x = pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
        const y = pad.t + innerH - (p.value / max) * innerH
        return { x, y, ...p }
      }),
    [points, innerH, innerW, max, pad.l, pad.t],
  )

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)?.x ?? pad.l},${pad.t + innerH} L${coords[0]?.x ?? pad.l},${pad.t + innerH} Z`
  const active = hover !== null ? coords[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full overflow-visible" role="img">
        <defs>
          <linearGradient id="caFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7aa8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1f7aa8" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="caStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0e628e" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
          <filter id="caGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 0.5, 1].map((t) => {
          const y = pad.t + innerH * (1 - t)
          return (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
                {t === 0 ? '0' : formatCompact(max * t)}
              </text>
            </g>
          )
        })}
        <path d={area} fill="url(#caFill)" className="origin-bottom animate-[ds-fade-up_0.8s_ease-out]" />
        <path
          d={line}
          fill="none"
          stroke="url(#caStroke)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#caGlow)"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
        />
        {coords.map((c, i) => (
          <g key={c.label}>
            <rect
              x={c.x - innerW / points.length / 2}
              y={pad.t}
              width={Math.max(12, innerW / points.length)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
            <circle
              cx={c.x}
              cy={c.y}
              r={hover === i ? 6 : 3.5}
              fill="#fff"
              stroke="#0e628e"
              strokeWidth="2.2"
              className="transition-all"
            />
            <text
              x={c.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="10"
              fontWeight={hover === i ? 700 : 500}
            >
              {points.length > 12 && i % 4 !== 0 && hover !== i ? '' : c.label}
            </text>
          </g>
        ))}
        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={pad.t}
            y2={pad.t + innerH}
            stroke="#0e628e"
            strokeOpacity="0.25"
            strokeDasharray="3 4"
          />
        )}
      </svg>
      {active && (
        <div className="pointer-events-none absolute start-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-white/70 bg-slate-900/90 px-3 py-2 text-white shadow-lg">
          <p className="text-[11px] text-slate-300">{active.label}</p>
          <p className="text-sm font-semibold">{formatDA(active.value)}</p>
          <p className="text-[11px] text-sky-200">{active.visits} passage{active.visits > 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

function formatCompact(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}
