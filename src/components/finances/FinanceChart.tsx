import { useMemo, useState } from 'react'
import { formatDA } from '../../lib/money'
import type { FinanceChartPoint } from '../../lib/finances'
import { useT } from '../../i18n'

interface Props {
  points: FinanceChartPoint[]
}

export function FinanceChart({ points }: Props) {
  const t = useT()
  const [hover, setHover] = useState<number | null>(null)
  const width = 760
  const height = 248
  const pad = { l: 48, r: 16, t: 20, b: 36 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const max = Math.max(1, ...points.map((p) => Math.max(p.value, p.billed)))
  const coords = useMemo(
    () =>
      points.map((p, i) => {
        const x = pad.l + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW)
        const yPaid = pad.t + innerH - (p.value / max) * innerH
        const yBilled = pad.t + innerH - (p.billed / max) * innerH
        return { x, yPaid, yBilled, ...p }
      }),
    [points, innerH, innerW, max, pad.l, pad.t],
  )

  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.yPaid.toFixed(1)}`).join(' ')
  const area = `${line} L${coords.at(-1)?.x ?? pad.l},${pad.t + innerH} L${coords[0]?.x ?? pad.l},${pad.t + innerH} Z`
  const active = hover !== null ? coords[hover] : null
  const barW = Math.max(4, Math.min(22, innerW / Math.max(points.length, 1) - 6))

  if (points.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-slate-400">{t('finances.chartEmpty')}</p>
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[240px] w-full overflow-visible" role="img">
        <defs>
          <linearGradient id="finFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1f7aa8" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1f7aa8" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="finStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#0e628e" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = pad.t + innerH * (1 - ratio)
          return (
            <g key={ratio}>
              <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />
              <text x={pad.l - 8} y={y + 4} textAnchor="end" className="fill-slate-400" fontSize="10">
                {ratio === 0 ? '0' : formatCompact(max * ratio)}
              </text>
            </g>
          )
        })}
        {coords.map((c, i) => (
          <rect
            key={`bar-${c.iso}`}
            x={c.x - barW / 2}
            y={c.yBilled}
            width={barW}
            height={Math.max(0, pad.t + innerH - c.yBilled)}
            rx={3}
            fill="#cbd5e1"
            opacity={hover === i || hover === null ? 0.55 : 0.25}
          />
        ))}
        <path d={area} fill="url(#finFill)" />
        <path
          d={line}
          fill="none"
          stroke="url(#finStroke)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <g key={c.iso}>
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
              cy={c.yPaid}
              r={hover === i ? 6 : 3.5}
              fill="#fff"
              stroke="#0e628e"
              strokeWidth="2.2"
            />
            <text
              x={c.x}
              y={height - 10}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="10"
              fontWeight={hover === i ? 700 : 500}
            >
              {points.length > 14 && i % 2 !== 0 && hover !== i ? '' : c.label}
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
          <p className="text-[11px] text-sky-200">
            {t('finances.billed')}: {formatDA(active.billed)} · {active.count} {t('finances.txShort')}
          </p>
        </div>
      )}
    </div>
  )
}

function formatCompact(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(Math.round(n))
}
