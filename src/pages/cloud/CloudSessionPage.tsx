import { useCloudAuth } from '../../cloud/CloudAuthContext'

export function CloudSessionPage() {
  const { context, permissions } = useCloudAuth()
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-slate-400">Utilisateur</p>
          <p className="text-sm">{context?.user?.email ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Organisation</p>
          <p className="text-sm">{context?.organization?.name ?? '—'}</p>
          <p className="font-mono text-[11px] text-slate-400">{context?.organization?.id}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">Rôle</p>
          <p className="text-sm">{context?.role ?? context?.membership?.role ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-400">État</p>
          <p className="font-mono text-xs">{context?.state ?? context?.status}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <p className="text-xs uppercase text-slate-400">Permissions ({permissions.length})</p>
        <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-[11px] text-slate-600">
          {permissions.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-slate-500">
        Modules : Patients, RDV, Clinique, Ordonnances, Dentistes, Facturation, Stock, Prothèses,
        Documents. DELETE hard si permission API. orgId jamais envoyé par le Renderer.
      </p>
    </div>
  )
}
