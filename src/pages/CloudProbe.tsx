import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Cloud, LoaderCircle, LogOut, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'
import { CloudClientError, cloudErrorLabel, isSessionExpiredError } from '../cloud/errors'
import { isCloudProbeActive, readCloudConfig } from '../cloud/bridge'
import {
  createCloudPatient,
  listCloudPatients,
  patientsCreateStateFromError,
  patientsLoadStateFromError,
  patientsUpdateStateFromError,
  updateCloudPatient,
  validateCloudPatientCreate,
  validateCloudPatientUpdate,
  type CloudPatientCreateState,
  type CloudPatientUpdateState,
  type CloudPatientsLoadState,
} from '../cloud/patientsRepository'
import { loginCloud, logoutCloud, restoreCloudSession } from '../cloud/session'
import type {
  CloudAuthState,
  CloudPatient,
  CloudPatientCreateInput,
  CloudPatientUpdateInput,
  CloudSessionContext,
} from '../cloud/types'

function authLabel(context: CloudSessionContext | null, phase: string): string {
  if (phase === 'loading' || context?.state === 'AUTHENTICATING' || context?.status === 'authenticating') {
    return 'Authentification…'
  }
  if (context?.state === 'AUTHENTICATED' || context?.status === 'authenticated') return 'Connecté'
  if (context?.state === 'SESSION_EXPIRED' || context?.status === 'expired') return 'Session expirée'
  if (context?.state === 'AUTH_ERROR' || context?.status === 'error') return 'Erreur d’authentification'
  return 'Non connecté'
}

function isAuthenticated(context: CloudSessionContext | null): boolean {
  return context?.state === 'AUTHENTICATED' || context?.status === 'authenticated' || context?.authenticated === true
}

function patientsStatusLabel(state: CloudPatientsLoadState): string {
  switch (state) {
    case 'LOADING':
      return 'Chargement des patients…'
    case 'SUCCESS':
      return 'Patients Cloud chargés'
    case 'EMPTY':
      return 'Aucun patient Cloud pour cette organisation'
    case 'UNAUTHENTICATED':
      return 'Non authentifié — connectez-vous pour voir les patients'
    case 'SESSION_EXPIRED':
      return 'Session expirée — reconnectez-vous'
    case 'FORBIDDEN':
      return 'Permission refusée (patients.read)'
    case 'API_ERROR':
      return 'Erreur API patients'
    default:
      return 'En attente'
  }
}

const emptyCreateForm = (): CloudPatientCreateInput => ({
  firstName: '',
  lastName: '',
  phone: '',
  age: 0,
  address: '',
  antecedents: '',
  hasAllergies: false,
  dentistId: null,
  notes: null,
})

export function CloudProbe() {
  const [phase, setPhase] = useState<'boot' | 'disabled' | 'login' | 'loading' | 'ready' | 'error'>('boot')
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState<CloudSessionContext | null>(null)
  const [patients, setPatients] = useState<CloudPatient[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [localFilter, setLocalFilter] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [apiBase, setApiBase] = useState('')
  const [busy, setBusy] = useState(false)
  const [patientsState, setPatientsState] = useState<CloudPatientsLoadState>('IDLE')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CloudPatientCreateInput>(emptyCreateForm)
  const [createState, setCreateState] = useState<CloudPatientCreateState>('IDLE')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<CloudPatientUpdateInput | null>(null)
  const [updateState, setUpdateState] = useState<CloudPatientUpdateState>('IDLE')
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null)

  const applyError = useCallback((err: unknown) => {
    if (err instanceof CloudClientError) {
      setError(cloudErrorLabel(err))
      setPatientsState(patientsLoadStateFromError(err))
      if (isSessionExpiredError(err) || err.kind === 'credentials') {
        setPatients([])
        if (err.kind === 'credentials') {
          setPhase('login')
          return
        }
        setContext({ status: 'expired', state: 'SESSION_EXPIRED', authenticated: false })
        setPhase('login')
        return
      }
      if (err.kind === 'disabled') {
        setPhase('disabled')
        return
      }
      if (err.kind === 'forbidden') {
        setPhase('ready')
        return
      }
    } else {
      setError(err instanceof Error ? err.message : String(err))
      setPatientsState('API_ERROR')
    }
    setPhase('error')
  }, [])

  const loadPatients = useCallback(
    async (q?: string) => {
      setBusy(true)
      setError(null)
      setPatientsState('LOADING')
      try {
        const list = await listCloudPatients({ search: q ?? search, page: 1, limit: 50 })
        setPatients(list.items)
        setTotal(list.total)
        setPatientsState(list.items.length === 0 ? 'EMPTY' : 'SUCCESS')
        setPhase('ready')
      } catch (err) {
        applyError(err)
      } finally {
        setBusy(false)
      }
    },
    [applyError, search],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const active = await isCloudProbeActive()
        const cfg = await readCloudConfig()
        if (cancelled) return
        setApiBase(cfg.apiBaseUrl)
        if (!active) {
          setPhase('disabled')
          return
        }
        setPhase('loading')
        const restored = await restoreCloudSession()
        if (cancelled) return
        setContext(restored)
        if (isAuthenticated(restored)) {
          await loadPatients('')
        } else {
          setPatientsState('UNAUTHENTICATED')
          setPhase('login')
        }
      } catch (err) {
        if (!cancelled) applyError(err)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, [])

  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const next = await loginCloud(email.trim(), password)
      setPassword('')
      setContext(next)
      await loadPatients('')
    } catch (err) {
      applyError(err)
      setPhase('login')
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    setBusy(true)
    try {
      await logoutCloud()
      setContext({ status: 'none', state: 'UNAUTHENTICATED', authenticated: false })
      setPatients([])
      setTotal(0)
      setPatientsState('UNAUTHENTICATED')
      setShowCreate(false)
      setCreateForm(emptyCreateForm())
      setCreateState('IDLE')
      setCreateError(null)
      setCreateSuccess(null)
      setEditingId(null)
      setEditForm(null)
      setUpdateState('IDLE')
      setUpdateError(null)
      setUpdateSuccess(null)
      setPhase('login')
      setError(null)
    } catch (err) {
      applyError(err)
    } finally {
      setBusy(false)
    }
  }

  const onCreateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (createState === 'SUBMITTING') return

    setCreateError(null)
    setCreateSuccess(null)

    const validated = validateCloudPatientCreate(createForm)
    if (!validated.ok) {
      setCreateState('VALIDATION_ERROR')
      setCreateError(validated.message)
      return
    }

    setCreateState('SUBMITTING')
    try {
      const patient = await createCloudPatient(validated.data)
      setCreateState('SUCCESS')
      setCreateSuccess(`Patient créé : ${patient.lastName} ${patient.firstName} (${patient.id})`)
      setShowCreate(false)
      setCreateForm(emptyCreateForm())
      await loadPatients(search)
      setCreateState('IDLE')
    } catch (err) {
      setCreateState(patientsCreateStateFromError(err))
      if (err instanceof CloudClientError) {
        setCreateError(cloudErrorLabel(err))
        if (isSessionExpiredError(err)) {
          setContext({ status: 'expired', state: 'SESSION_EXPIRED', authenticated: false })
          setPhase('login')
        }
      } else {
        setCreateError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const openEdit = (patient: CloudPatient) => {
    setShowCreate(false)
    setCreateError(null)
    setUpdateError(null)
    setUpdateSuccess(null)
    setEditingId(patient.id)
    setEditForm({
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      age: patient.age,
      address: patient.address,
      antecedents: patient.antecedents,
      hasAllergies: patient.hasAllergies,
      dentistId: patient.dentistId,
      notes: patient.notes,
    })
    setUpdateState('IDLE')
  }

  const onUpdateSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (updateState === 'SUBMITTING' || !editForm) return

    setUpdateError(null)
    setUpdateSuccess(null)

    const validated = validateCloudPatientUpdate(editForm)
    if (!validated.ok) {
      setUpdateState('VALIDATION_ERROR')
      setUpdateError(validated.message)
      return
    }

    setUpdateState('SUBMITTING')
    try {
      const patient = await updateCloudPatient(validated.data)
      setUpdateState('SUCCESS')
      setUpdateSuccess(`Patient modifié : ${patient.lastName} ${patient.firstName}`)
      setEditingId(null)
      setEditForm(null)
      await loadPatients(search)
      setUpdateState('IDLE')
    } catch (err) {
      setUpdateState(patientsUpdateStateFromError(err))
      if (err instanceof CloudClientError) {
        setUpdateError(cloudErrorLabel(err))
        if (isSessionExpiredError(err)) {
          setContext({ status: 'expired', state: 'SESSION_EXPIRED', authenticated: false })
          setPhase('login')
        }
      } else {
        setUpdateError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  const visiblePatients = useMemo(() => {
    const q = localFilter.trim().toLowerCase()
    if (!q) return patients
    return patients.filter((p) => {
      const hay = `${p.lastName} ${p.firstName} ${p.phone}`.toLowerCase()
      return hay.includes(q)
    })
  }, [patients, localFilter])

  if (phase === 'boot' || phase === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm">Cloud probe…</p>
        </div>
      </div>
    )
  }

  if (phase === 'disabled') {
    return (
      <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-950">Cloud probe désactivé</h1>
        <p className="text-sm text-amber-900">
          Phase 8B reste feature-flaggée. Le mode normal reste LEGACY_LOCAL. Pour tester :
        </p>
        <pre className="overflow-x-auto rounded-lg bg-white/80 p-3 text-xs text-slate-800">
          {`DENTISUITE_CLOUD_PROBE=1\nDENTISUITE_API_BASE_URL=http://127.0.0.1:3001`}
        </pre>
        <p className="text-xs text-amber-800">CLOUD_MODE global : non actif. Patients Cloud = list + create + update.</p>
      </div>
    )
  }

  const connected = isAuthenticated(context)
  const permissionList = context?.permissions?.permissions ?? []
  const canReadPatientsUi = permissionList.includes('patients.read')
  const canCreatePatientsUi = permissionList.includes('patients.create')
  const canUpdatePatientsUi = permissionList.includes('patients.update')
  const authState: CloudAuthState =
    context?.state ??
    (connected
      ? 'AUTHENTICATED'
      : context?.status === 'expired'
        ? 'SESSION_EXPIRED'
        : 'UNAUTHENTICATED')
  const submitting = createState === 'SUBMITTING' || updateState === 'SUBMITTING'

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-sky-700" />
            <h1 className="text-2xl font-semibold text-slate-900">Cloud (Phase 8C)</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Patients Cloud — lecture + création + modification. Pas de delete. Zustand / JSON local inchangés.
          </p>
          {apiBase ? <p className="mt-1 text-xs text-slate-400">API: {apiBase}</p> : null}
        </div>
        {connected ? (
          <button
            type="button"
            onClick={() => void onLogout()}
            disabled={busy || submitting}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">État</span>
        <p className="font-medium text-slate-900">{authLabel(context, phase)}</p>
        <p className="font-mono text-[11px] text-slate-400">{authState}</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {createSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {createSuccess}
        </div>
      ) : null}

      {updateSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {updateSuccess}
        </div>
      ) : null}

      {!connected ? (
        <form
          onSubmit={(e) => void onLogin(e)}
          className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-800">Cloud login</h2>
          <p className="text-xs text-slate-500">Distinct du License Manager desktop. Le token reste dans Electron Main.</p>
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
          >
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Utilisateur</p>
              <p className="text-sm text-slate-800">{context?.user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Organisation</p>
              <p className="text-sm text-slate-800">{context?.organization?.name ?? '—'}</p>
              <p className="font-mono text-[11px] text-slate-400">{context?.organization?.id ?? ''}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Rôle</p>
              <p className="text-sm text-slate-800">
                {context?.role ?? context?.membership?.role ?? context?.permissions?.role ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Membership</p>
              <p className="font-mono text-[11px] text-slate-500">{context?.membership?.id ?? '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Permissions</p>
            {permissionList.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Aucune permission renvoyée par l’API</p>
            ) : (
              <ul className="mt-2 max-h-40 overflow-y-auto font-mono text-[11px] text-slate-600">
                {permissionList.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            )}
            {!canReadPatientsUi ? (
              <p className="mt-2 text-xs text-amber-700">
                Hint UI : patients.read absent — l’API reste l’autorité (403 possible).
              </p>
            ) : null}
            {!canCreatePatientsUi ? (
              <p className="mt-2 text-xs text-amber-700">
                Hint UI : patients.create absent — création masquée côté UI (API autorité).
              </p>
            ) : null}
            {!canUpdatePatientsUi ? (
              <p className="mt-2 text-xs text-amber-700">
                Hint UI : patients.update absent — modification masquée côté UI (API autorité).
              </p>
            ) : null}
          </div>

          <section className="space-y-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Patients Cloud</h2>
                <p className="text-sm text-slate-600">
                  Patients Cloud : <span className="font-semibold text-slate-900">{total}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span className="font-mono text-[11px] text-slate-500">{patientsState}</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{patientsStatusLabel(patientsState)}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Update only beyond create — pas de suppression Cloud.
                </p>
              </div>
              {canCreatePatientsUi ? (
                <button
                  type="button"
                  disabled={busy || submitting}
                  onClick={() => {
                    setEditingId(null)
                    setEditForm(null)
                    setShowCreate(true)
                    setCreateError(null)
                    setCreateState('IDLE')
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Nouveau patient
                </button>
              ) : null}
            </div>

            {showCreate ? (
              <form
                onSubmit={(e) => void onCreateSubmit(e)}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Nouveau patient Cloud</h3>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setShowCreate(false)
                      setCreateError(null)
                      setCreateState('IDLE')
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  orgId non éditable — dérivé de la session. État :{' '}
                  <span className="font-mono">{createState}</span>
                </p>
                {createError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {createError}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Nom *
                    <input
                      value={createForm.lastName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={100}
                      disabled={submitting}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Prénom *
                    <input
                      value={createForm.firstName}
                      onChange={(e) => setCreateForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={100}
                      disabled={submitting}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Téléphone *
                    <input
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={40}
                      disabled={submitting}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Âge *
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={createForm.age || ''}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, age: Number(e.target.value || 0) }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      disabled={submitting}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Adresse
                    <input
                      value={createForm.address ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, address: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      maxLength={500}
                      disabled={submitting}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Antécédents
                    <textarea
                      value={createForm.antecedents ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, antecedents: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      maxLength={5000}
                      disabled={submitting}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(createForm.hasAllergies)}
                      onChange={(e) =>
                        setCreateForm((f) => ({ ...f, hasAllergies: e.target.checked }))
                      }
                      disabled={submitting}
                    />
                    Allergies
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Notes
                    <textarea
                      value={createForm.notes ?? ''}
                      onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      maxLength={5000}
                      disabled={submitting}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setShowCreate(false)
                      setCreateError(null)
                      setCreateState('IDLE')
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Création…
                      </>
                    ) : (
                      'Créer'
                    )}
                  </button>
                </div>
              </form>
            ) : null}

            {editingId && editForm ? (
              <form
                onSubmit={(e) => void onUpdateSubmit(e)}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Modifier patient Cloud</h3>
                  <button
                    type="button"
                    disabled={updateState === 'SUBMITTING'}
                    onClick={() => {
                      setEditingId(null)
                      setEditForm(null)
                      setUpdateError(null)
                      setUpdateState('IDLE')
                    }}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Fermer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  UUID : <span className="font-mono">{editForm.id}</span> — orgId non éditable. État :{' '}
                  <span className="font-mono">{updateState}</span>
                </p>
                {updateError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {updateError}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Nom *
                    <input
                      value={editForm.lastName ?? ''}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, lastName: e.target.value } : f))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={100}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Prénom *
                    <input
                      value={editForm.firstName ?? ''}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, firstName: e.target.value } : f))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={100}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Téléphone *
                    <input
                      value={editForm.phone ?? ''}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, phone: e.target.value } : f))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      maxLength={40}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Âge *
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={editForm.age ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, age: Number(e.target.value || 0) } : f))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      required
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Adresse
                    <input
                      value={editForm.address ?? ''}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, address: e.target.value } : f))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      maxLength={500}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Antécédents
                    <textarea
                      value={editForm.antecedents ?? ''}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, antecedents: e.target.value } : f))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      maxLength={5000}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={Boolean(editForm.hasAllergies)}
                      onChange={(e) =>
                        setEditForm((f) => (f ? { ...f, hasAllergies: e.target.checked } : f))
                      }
                      disabled={updateState === 'SUBMITTING'}
                    />
                    Allergies
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Notes
                    <textarea
                      value={editForm.notes ?? ''}
                      onChange={(e) => setEditForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      rows={2}
                      maxLength={5000}
                      disabled={updateState === 'SUBMITTING'}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={updateState === 'SUBMITTING'}
                    onClick={() => {
                      setEditingId(null)
                      setEditForm(null)
                      setUpdateError(null)
                      setUpdateState('IDLE')
                    }}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={updateState === 'SUBMITTING'}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {updateState === 'SUBMITTING' ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Enregistrement…
                      </>
                    ) : (
                      'Enregistrer'
                    )}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Recherche API (search)"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="relative min-w-[160px] flex-1">
                <input
                  value={localFilter}
                  onChange={(e) => setLocalFilter(e.target.value)}
                  placeholder="Filtre local (liste chargée)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy || patientsState === 'LOADING' || submitting}
                onClick={() => void loadPatients(search)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            {patientsState === 'LOADING' ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Chargement…
              </div>
            ) : patientsState === 'FORBIDDEN' ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
                Accès patients refusé (403). L’API a refusé la lecture.
              </div>
            ) : patientsState === 'EMPTY' || visiblePatients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Aucun patient Cloud
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nom</th>
                      <th className="px-4 py-3 font-medium">Prénom</th>
                      <th className="px-4 py-3 font-medium">Téléphone</th>
                      <th className="px-4 py-3 font-medium">Âge</th>
                      <th className="px-4 py-3 font-medium">Id (UUID)</th>
                      {canUpdatePatientsUi ? (
                        <th className="px-4 py-3 font-medium">Actions</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePatients.map((p) => (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{p.lastName}</td>
                        <td className="px-4 py-3 text-slate-700">{p.firstName}</td>
                        <td className="px-4 py-3 text-slate-600">{p.phone}</td>
                        <td className="px-4 py-3 text-slate-600">{p.age}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{p.id}</td>
                        {canUpdatePatientsUi ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => openEdit(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
