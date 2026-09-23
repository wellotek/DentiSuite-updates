import { Star } from 'lucide-react'
import type { ActCategory, ActItem, CareStatus } from '../../types'
import { ACT_CATEGORIES } from '../../data/acts'
import { formatDA } from '../../lib/money'
import { useState } from 'react'

interface ActsPaletteProps {
  catalog: ActItem[]
  careStatus: CareStatus
  onCareStatus: (status: CareStatus) => void
  selectedCount: number
  onApply: (act: ActItem) => void | Promise<void>
  onToggleFavorite: (id: string) => void
}

export function ActsPalette({
  catalog,
  careStatus,
  onCareStatus,
  selectedCount,
  onApply,
  onToggleFavorite,
}: ActsPaletteProps) {
  const [category, setCategory] = useState<ActCategory | 'favoris'>('favoris')
  const favorites = catalog.filter((a) => a.favorite)
  const items =
    category === 'favoris' ? favorites : catalog.filter((a) => a.category === category)

  return (
    <aside className="flex w-full flex-col rounded-xl border border-slate-200 bg-white shadow-card lg:w-[320px]">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Actes / Soins</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {selectedCount > 0
            ? `Appliquer sur ${selectedCount} dent${selectedCount > 1 ? 's' : ''}`
            : 'Sélectionnez des dents, ou un acte général'}
        </p>
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Statut avant validation</p>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onCareStatus('a_faire')}
            className={`rounded-md px-2 py-2 text-xs font-semibold ${
              careStatus === 'a_faire' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            À faire
          </button>
          <button
            type="button"
            onClick={() => onCareStatus('fait')}
            className={`rounded-md px-2 py-2 text-xs font-semibold ${
              careStatus === 'fait' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            Fait
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {careStatus === 'a_faire'
            ? 'Plan de traitement / devis — dent en rouge.'
            : 'Réalisé — ajouté à la caisse du jour, dent en vert.'}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pb-2">
        <CatChip active={category === 'favoris'} onClick={() => setCategory('favoris')} label="Favoris" />
        {ACT_CATEGORIES.map((c) => (
          <CatChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} label={c.label} />
        ))}
      </div>

      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {items.map((act) => (
          <li key={act.id}>
            <div className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => onApply(act)}
                className="flex min-w-0 flex-1 items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:border-clinic-200 hover:bg-clinic-50"
              >
                <span>
                  <span className="block font-mono text-[10px] font-semibold text-clinic-700">{act.code}</span>
                  <span className="block text-xs font-medium text-slate-800">{act.name}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-700">{formatDA(act.tariff)}</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(act.id)}
                className="rounded-lg px-2 text-amber-500 hover:bg-amber-50"
                title="Favori"
              >
                <Star className={`h-4 w-4 ${act.favorite ? 'fill-amber-400' : ''}`} />
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-2 py-6 text-center text-xs text-slate-400">Aucun acte dans cette catégorie.</li>
        )}
      </ul>
    </aside>
  )
}

function CatChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? 'bg-clinic-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}
