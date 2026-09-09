import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Pencil, UserPlus } from 'lucide-react'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import {
  createTeamMember,
  DEFAULT_ASSISTANT_PERMISSIONS,
  listAuditLogs,
  listTeamMembers,
  memberDisplayLabel,
  removeTeamMember,
  TEAM_PERMISSION_GROUPS,
  updateTeamMember,
  type CloudAuditLog,
  type CloudTeamMember,
} from '../../cloud/modules/team'
import { CloudBanner, CloudLoading, CloudSyncBar, formatCloudError } from './ui'
import { useCloudLiveSync } from '../../cloud/useCloudLiveSync'

function generatePassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function roleLabel(role: string) {
  return role === 'ADMIN' ? 'Administrateur' : 'Assistant'
}

export function CloudTeamPage() {
  const { hasPermission, context } = useCloudAuth()
  const canRead = hasPermission('team.read')
  const canCreate = hasPermission('team.create')
  const canUpdate = hasPermission('team.update')
  const canDelete = hasPermission('team.delete')
  const canAudit = hasPermission('audit.read')

  const [items, setItems] = useState<CloudTeamMember[]>([])
  const [auditItems, setAuditItems] = useState<CloudAuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<CloudTeamMember | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    role: 'ASSISTANT' as 'ADMIN' | 'ASSISTANT',
  })
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    email: '',
    role: 'ASSISTANT' as 'ADMIN' | 'ASSISTANT',
    password: '',
  })
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    () => new Set(DEFAULT_ASSISTANT_PERMISSIONS),
  )
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!canRead) return
    setLoading(true)
    setError(null)
    try {
      const list = await listTeamMembers({ page: 1, limit: 100 })
      setItems(list.items)
      if (canAudit) {
        const audit = await listAuditLogs({ page: 1, limit: 40, module: 'team' }).catch(() => ({
          items: [] as CloudAuditLog[],
        }))
        setAuditItems(audit.items)
      }
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [canRead, canAudit])

  useEffect(() => {
    void load()
  }, [load])

  const { lastSyncedAt, syncing, refresh } = useCloudLiveSync({
    reload: load,
    enabled: canRead,
    poll: false,
  })

  const myMembershipId = useMemo(() => {
    const mid = context?.membership?.id
    return typeof mid === 'string' ? mid : null
  }, [context?.membership?.id])

  if (!canRead) {
    return (
      <CloudBanner kind="error">
        Accès refusé — la gestion d&apos;équipe est réservée aux administrateurs.
      </CloudBanner>
    )
  }

  const togglePerm = (key: string, setter: typeof setSelectedPerms) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const openEdit = (m: CloudTeamMember) => {
    setEditing(m)
    setEditForm({
      username: m.username || '',
      displayName: m.displayName || '',
      email: m.email.includes('@users.dentisuite.local') ? '' : m.email,
      role: m.role,
      password: '',
    })
    setEditPerms(new Set(m.permissions))
    setShowPassword(false)
    setMsg(null)
    setError(null)
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!canCreate || busy) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      await createTeamMember({
        username: form.username.trim(),
        displayName: form.displayName.trim() || undefined,
        email: form.email.trim() || undefined,
        password: form.password,
        role: form.role,
        permissions: form.role === 'ADMIN' ? undefined : [...selectedPerms],
      })
      setMsg('Collaborateur créé — il peut se connecter avec son username.')
      setShowForm(false)
      setForm({ username: '', displayName: '', email: '', password: '', role: 'ASSISTANT' })
      setSelectedPerms(new Set(DEFAULT_ASSISTANT_PERMISSIONS))
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  const onSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canUpdate || !editing || busy) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const body: Parameters<typeof updateTeamMember>[1] = {
        username: editForm.username.trim() || undefined,
        displayName: editForm.displayName.trim() || null,
        email: editForm.email.trim() || undefined,
        role: editForm.role,
      }
      if (editForm.role === 'ASSISTANT') {
        body.permissions = [...editPerms]
      }
      if (editForm.password.trim()) {
        if (
          !window.confirm(
            `Réinitialiser le mot de passe de ${memberDisplayLabel(editing)} ? Les sessions actives seront invalidées.`,
          )
        ) {
          setBusy(false)
          return
        }
        body.password = editForm.password.trim()
      }
      await updateTeamMember(editing.membershipId, body)
      setMsg('Membre mis à jour.')
      setEditing(null)
      await load()
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setBusy(false)
    }
  }

  const PermMatrix = ({
    role,
    perms,
    onToggle,
  }: {
    role: 'ADMIN' | 'ASSISTANT'
    perms: Set<string>
    onToggle: (key: string) => void
  }) =>
    role === 'ASSISTANT' ? (
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Permissions</p>
        <div className="grid gap-3 md:grid-cols-2">
          {TEAM_PERMISSION_GROUPS.map((group) => (
            <div key={group.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-medium text-slate-800">{group.label}</p>
              <ul className="mt-2 space-y-1">
                {group.permissions.map((p) => (
                  <li key={p.key}>
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={perms.has(p.key)}
                        onChange={() => onToggle(p.key)}
                      />
                      {p.label}
                      <span className="font-mono text-[10px] text-slate-400">{p.key}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <p className="text-xs text-slate-500">
        Un administrateur reçoit toutes les permissions du catalogue.
      </p>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Équipe du cabinet</h2>
          <p className="text-sm text-slate-500">
            Comptes Cloud rattachés à l&apos;organisation (multi-postes). Connexion par username.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CloudSyncBar lastSyncedAt={lastSyncedAt} syncing={syncing} onRefresh={() => void refresh()} />
          {canCreate ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v)
                setEditing(null)
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm text-white"
            >
              <UserPlus className="h-4 w-4" />
              Ajouter
            </button>
          ) : null}
        </div>
      </div>

      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {msg ? <CloudBanner kind="success">{msg}</CloudBanner> : null}

      {showForm ? (
        <form onSubmit={(e) => void onCreate(e)} className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="text-sm font-semibold">Nouveau collaborateur</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Username (connexion)
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{1,39}"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="sara"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Nom affiché
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Sarah Benali"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Email (optionnel)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Mot de passe initial
              <div className="mt-1 flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  className="rounded-lg border px-2"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 text-xs"
                  onClick={() => setForm({ ...form, password: generatePassword() })}
                >
                  Générer
                </button>
              </div>
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Rôle
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as 'ADMIN' | 'ASSISTANT'
                  setForm({ ...form, role })
                  if (role === 'ASSISTANT') {
                    setSelectedPerms(new Set(DEFAULT_ASSISTANT_PERMISSIONS))
                  }
                }}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="ASSISTANT">Assistant</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </label>
          </div>
          <PermMatrix
            role={form.role}
            perms={selectedPerms}
            onToggle={(k) => togglePerm(k, setSelectedPerms)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            >
              {busy ? 'Création…' : 'Créer le compte'}
            </button>
          </div>
        </form>
      ) : null}

      {editing ? (
        <form onSubmit={(e) => void onSaveEdit(e)} className="space-y-4 rounded-xl border bg-white p-5">
          <h3 className="text-sm font-semibold">
            Modifier — {memberDisplayLabel(editing)}
            {editing.username ? (
              <span className="ml-2 font-normal text-slate-500">@{editing.username}</span>
            ) : null}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Username
              <input
                type="text"
                required
                pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{1,39}"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Nom affiché
              <input
                type="text"
                value={editForm.displayName}
                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Email (optionnel)
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Rôle
              <select
                value={editForm.role}
                onChange={(e) =>
                  setEditForm({ ...editForm, role: e.target.value as 'ADMIN' | 'ASSISTANT' })
                }
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                disabled={editing.membershipId === myMembershipId}
              >
                <option value="ASSISTANT">Assistant</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
              Nouveau mot de passe (laisser vide pour ne pas changer)
              <div className="mt-1 flex gap-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  autoComplete="new-password"
                />
                <button type="button" className="rounded-lg border px-2" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 text-xs"
                  onClick={() => setEditForm({ ...editForm, password: generatePassword() })}
                >
                  Générer
                </button>
              </div>
            </label>
          </div>
          <PermMatrix
            role={editForm.role}
            perms={editPerms}
            onToggle={(k) => togglePerm(k, setEditPerms)}
          />
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              {canUpdate && editing.membershipId !== myMembershipId ? (
                <button
                  type="button"
                  className="rounded-lg border px-3 py-2 text-sm"
                  onClick={() =>
                    void updateTeamMember(editing.membershipId, {
                      status: editing.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                    })
                      .then(() => {
                        setMsg(editing.status === 'ACTIVE' ? 'Membre suspendu.' : 'Membre réactivé.')
                        setEditing(null)
                        return load()
                      })
                      .catch((e) => setError(formatCloudError(e)))
                  }
                >
                  {editing.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                </button>
              ) : null}
              {canDelete && editing.membershipId !== myMembershipId ? (
                <button
                  type="button"
                  className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700"
                  onClick={() => {
                    if (!window.confirm(`Retirer l’accès de ${memberDisplayLabel(editing)} ?`)) return
                    void removeTeamMember(editing.membershipId)
                      .then(() => {
                        setMsg('Accès retiré')
                        setEditing(null)
                        return load()
                      })
                      .catch((e) => setError(formatCloudError(e)))
                  }}
                >
                  Supprimer
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border px-3 py-2 text-sm" onClick={() => setEditing(null)}>
                Fermer
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {loading ? (
        <CloudLoading />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Identité</th>
                <th className="px-3 py-2 text-left">Username</th>
                <th className="px-3 py-2 text-left">Rôle</th>
                <th className="px-3 py-2 text-left">Statut</th>
                <th className="px-3 py-2 text-left">Ajouté</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.membershipId} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{memberDisplayLabel(m)}</div>
                    {!m.email.includes('@users.dentisuite.local') ? (
                      <div className="text-xs text-slate-500">{m.email}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.username ? `@${m.username}` : '—'}</td>
                  <td className="px-3 py-2">{roleLabel(m.role)}</td>
                  <td className="px-3 py-2">
                    <span className={m.status === 'ACTIVE' ? 'text-emerald-700' : 'text-amber-700'}>
                      {m.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-3 py-2 space-x-2">
                    {canUpdate ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-sky-700"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-3 w-3" />
                        Modifier
                      </button>
                    ) : null}
                    {canUpdate && m.membershipId !== myMembershipId ? (
                      <button
                        type="button"
                        className="text-xs text-sky-700"
                        onClick={() =>
                          void updateTeamMember(m.membershipId, {
                            status: m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          })
                            .then(load)
                            .catch((e) => setError(formatCloudError(e)))
                        }
                      >
                        {m.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                      </button>
                    ) : null}
                    {canDelete && m.membershipId !== myMembershipId ? (
                      <button
                        type="button"
                        className="text-xs text-rose-700"
                        onClick={() => {
                          if (!window.confirm(`Retirer l’accès de ${memberDisplayLabel(m)} ?`)) return
                          void removeTeamMember(m.membershipId)
                            .then(() => {
                              setMsg('Accès retiré')
                              return load()
                            })
                            .catch((e) => setError(formatCloudError(e)))
                        }}
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAudit && auditItems.length > 0 ? (
        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">Historique équipe</h3>
          <ul className="space-y-2 text-sm">
            {auditItems.map((a) => (
              <li key={a.id} className="border-b border-slate-100 pb-2 last:border-0">
                <div className="text-xs text-slate-500">
                  {new Date(a.createdAt).toLocaleString('fr-FR')}
                </div>
                <div>
                  <span className="font-medium">
                    {a.actorDisplayName || (a.actorUsername ? `@${a.actorUsername}` : 'Système')}
                  </span>
                  {a.actorRole ? (
                    <span className="text-slate-500"> / {roleLabel(a.actorRole)}</span>
                  ) : null}
                  <span className="text-slate-700"> — {a.summary || a.action}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
