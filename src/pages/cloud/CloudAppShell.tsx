import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  FileText,
  KeyRound,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Package,
  Settings,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react'
import { Logo } from '../../components/Logo'
import { CloudClientError, cloudErrorLabel, isCloudUnreachableError, isSessionExpiredError } from '../../cloud/errors'
import { isCloudModeActive, readCloudConfig } from '../../cloud/bridge'
import {
  bootstrapCloudOrganization,
  fetchCloudOnboardingStatus,
  loginCloud,
  logoutCloud,
  restoreCloudSession,
} from '../../cloud/session'
import { CloudAuthContext } from '../../cloud/CloudAuthContext'
import type { CloudSessionContext } from '../../cloud/types'
import { ActivateLicense } from '../ActivateLicense'
import { useAppStore } from '../../store/useAppStore'
import { CLINIC_SCHEMA_VERSION } from '../../data/seed'
import { setCloudClinicMode } from '../../cloud/cloudClinicMode'
import { hydrateClinicMirror } from '../../cloud/clinicMirror'
import { CloudBanner } from './ui'
import { ToastProvider } from '../../components/ui/Toast'
import { GlobalSearchHost, GlobalSearchTrigger } from '../../components/search/GlobalSearch'

type OnboardingStep =
  | 'CHECK_LICENSE'
  | 'LICENSE_ACTIVATION'
  | 'REGISTER_CLINIC'
  | 'LOGIN'
  | 'AUTHENTICATED'

const ToothIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2c-2.4 0-4.3 1.7-4.8 4-.6 2.6.2 5.2 1.1 7.6.6 1.6 1.2 3.2 1.2 4.9 0 1.4.8 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0-1.7.6-3.3 1.2-4.9.9-2.4 1.7-5 1.1-7.6C16.3 3.7 14.4 2 12 2z" />
  </svg>
)

const NAV: Array<{
  to: string
  label: string
  icon: typeof LayoutDashboard | typeof ToothIcon
  end?: boolean
  perm: string | null
}> = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true, perm: null },
  { to: '/patients', label: 'Patients', icon: Users, perm: 'patients.read' },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, perm: 'appointments.read' },
  { to: '/praticiens', label: 'Dentistes', icon: Stethoscope, perm: 'dentists.read' },
  { to: '/protheses', label: 'Prothèses', icon: ToothIcon, perm: 'patients.read' },
  { to: '/ordonnances', label: 'Ordonnances', icon: FileText, perm: 'prescriptions.read' },
  { to: '/stock', label: 'Stock', icon: Package, perm: 'stock.read' },
  { to: '/finances', label: 'Finances', icon: Wallet, perm: 'billing.read' },
  { to: '/documents', label: 'Documents', icon: FileText, perm: 'documents.read' },
  { to: '/parametres', label: 'Paramètres', icon: Settings, perm: null },
  { to: '/team', label: 'Équipe', icon: Users, perm: 'team.read' },
]

function isAuthenticated(context: CloudSessionContext | null): boolean {
  return (
    context?.state === 'AUTHENTICATED' ||
    context?.status === 'authenticated' ||
    context?.authenticated === true
  )
}

export function CloudAppShell({ children }: { children?: ReactNode }) {
  const license = useAppStore((s) => s.license)
  const settings = useAppStore((s) => s.clinic.settings)
  const [boot, setBoot] = useState(true)
  const [step, setStep] = useState<OnboardingStep>('CHECK_LICENSE')
  const [modeError, setModeError] = useState<string | null>(null)
  const [apiDown, setApiDown] = useState(false)
  const [apiBaseUrl, setApiBaseUrl] = useState('https://dentisuite-api-production.up.railway.app')
  const [context, setContext] = useState<CloudSessionContext | null>(null)
  const [clinicLoading, setClinicLoading] = useState(false)
  const replaceClinicMirror = useAppStore((s) => s.replaceClinicMirror)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [orgLabel, setOrgLabel] = useState('DentiSuite')

  const [organizationName, setOrganizationName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('')

  const refreshSession = useCallback(async () => {
    const restored = await restoreCloudSession()
    setContext(restored)
  }, [])

  const noopReload = useCallback(() => undefined, [])

  const enterAuthenticated = useCallback(async (next: CloudSessionContext) => {
    setContext(next)
    if (next.organization?.name) setOrgLabel(next.organization.name)
    setStep('AUTHENTICATED')
    setCloudClinicMode(true)
    setClinicLoading(true)
    try {
      await hydrateClinicMirror({
        organizationName: next.organization?.name,
      })
    } catch (err) {
      setError(err instanceof CloudClientError ? cloudErrorLabel(err) : String(err))
    } finally {
      setClinicLoading(false)
    }
  }, [])

  const resolvePostLicenseStep = useCallback(async () => {
    try {
      const restored = await restoreCloudSession()
      setContext(restored)
      setApiDown(false)
      if (isAuthenticated(restored)) {
        await enterAuthenticated(restored)
        return
      }
    } catch (err) {
      const kind = err instanceof CloudClientError ? err.kind : ''
      if (isCloudUnreachableError(err) || kind === 'network') {
        setApiDown(true)
        setError(cloudErrorLabel(err as CloudClientError))
        setStep('LOGIN')
        return
      }
      if (isSessionExpiredError(err)) {
        setContext({ status: 'expired', state: 'SESSION_EXPIRED', authenticated: false })
      } else {
        setContext({ status: 'none', state: 'UNAUTHENTICATED', authenticated: false })
        if (err instanceof CloudClientError && err.kind !== 'disabled') {
          setError(cloudErrorLabel(err))
        }
      }
    }

    const licenseKey = license.licenseId?.trim()
    if (licenseKey) {
      try {
        const status = await fetchCloudOnboardingStatus(licenseKey)
        setStep(status.registered ? 'LOGIN' : 'REGISTER_CLINIC')
        if (status.organizationName) setOrgLabel(status.organizationName)
        return
      } catch {
        // API unreachable or bridge missing — fall through to login.
      }
    }
    setStep('LOGIN')
  }, [license.licenseId, enterAuthenticated])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const active = await isCloudModeActive()
        const cfg = await readCloudConfig()
        if (cancelled) return
        if (cfg.apiBaseUrl) setApiBaseUrl(cfg.apiBaseUrl)
        if (!active) {
          setModeError('Mode Cloud inactif. Relancez avec DENTISUITE_APP_MODE=CLOUD.')
          setBoot(false)
          return
        }
        void cfg

        if (!license.activated) {
          setStep('LICENSE_ACTIVATION')
          setBoot(false)
          return
        }

        await resolvePostLicenseStep()
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof CloudClientError ? cloudErrorLabel(err) : String(err))
          setStep('LOGIN')
        }
      } finally {
        if (!cancelled) setBoot(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Only on first mount — license activation completion is handled via onActivated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setApiDown(false)
    try {
      const next = await loginCloud(email.trim(), password)
      setPassword('')
      await enterAuthenticated(next)
    } catch (err) {
      if (isCloudUnreachableError(err)) setApiDown(true)
      setError(err instanceof CloudClientError ? cloudErrorLabel(err) : String(err))
      if (isSessionExpiredError(err)) {
        setContext({ status: 'expired', state: 'SESSION_EXPIRED', authenticated: false })
      }
    } finally {
      setBusy(false)
    }
  }

  const onRegisterClinic = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (adminPassword !== adminPasswordConfirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (adminPassword.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    const licenseKey = license.licenseId?.trim()
    if (!licenseKey) {
      setError('Licence introuvable. Activez d’abord votre clé.')
      setStep('LICENSE_ACTIVATION')
      return
    }

    setBusy(true)
    setApiDown(false)
    try {
      const next = await bootstrapCloudOrganization({
        licenseKey,
        organizationName: organizationName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
        adminName: adminName.trim(),
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      })
      setAdminPassword('')
      setAdminPasswordConfirm('')
      await enterAuthenticated(next)
    } catch (err) {
      if (isCloudUnreachableError(err)) setApiDown(true)
      setError(err instanceof CloudClientError ? cloudErrorLabel(err) : String(err))
    } finally {
      setBusy(false)
    }
  }

  const onLogout = async () => {
    setBusy(true)
    try {
      await logoutCloud()
      setCloudClinicMode(false)
      replaceClinicMirror({
        schemaVersion: CLINIC_SCHEMA_VERSION,
        patients: [],
        appointments: [],
        prostheses: [],
        invoices: [],
        treatments: [],
        dentists: [],
        settings: useAppStore.getState().clinic.settings,
        actCatalog: useAppStore.getState().clinic.actCatalog,
        medicationCatalog: useAppStore.getState().clinic.medicationCatalog ?? [],
        stockItems: [],
        sessions: [],
        mediaFiles: [],
        prescriptions: [],
      })
      setContext({ status: 'none', state: 'UNAUTHENTICATED', authenticated: false })
      setStep('LOGIN')
    } catch (err) {
      setError(err instanceof CloudClientError ? cloudErrorLabel(err) : String(err))
    } finally {
      setBusy(false)
    }
  }

  const connected = isAuthenticated(context) && step === 'AUTHENTICATED'
  const permissions = context?.permissions?.permissions ?? []
  const authValue = useMemo(
    () => ({
      context,
      connected,
      permissions,
      hasPermission: (key: string) => permissions.includes(key),
      refreshSession,
      reload: noopReload,
    }),
    [context, connected, permissions, refreshSession, noopReload],
  )

  if (boot || step === 'CHECK_LICENSE') {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f7fa]">
        <div className="flex flex-col items-center gap-3 text-clinic-700">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">Chargement de DentiSuite…</p>
        </div>
      </div>
    )
  }

  if (modeError) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f7fa] p-6">
        <div className="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-lg font-semibold text-amber-950">Configuration</h1>
          <p className="mt-2 text-sm text-amber-900">{modeError}</p>
        </div>
      </div>
    )
  }

  if (step === 'LICENSE_ACTIVATION') {
    return (
      <ActivateLicense
        onActivated={() => {
          setBoot(true)
          void resolvePostLicenseStep().finally(() => setBoot(false))
        }}
      />
    )
  }

  if (apiDown && !connected) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f4f7fa] p-6">
        <div className="max-w-md space-y-3 rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-rose-900">Serveur inaccessible</h1>
          <p className="text-sm text-slate-600">
            Impossible de joindre l&apos;API DentiSuite. Vérifiez que l&apos;API Cloud est démarrée
            et que l&apos;URL configurée est correcte. Le mode local n&apos;est pas activé
            automatiquement.
          </p>
          <p className="rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
            API : {apiBaseUrl || 'https://dentisuite-api-production.up.railway.app'}
          </p>
          <p className="text-xs text-slate-500">
            Démarrez l&apos;API (`npm run api:dev`) ou définissez{' '}
            <span className="font-mono">DENTISUITE_API_BASE_URL</span> vers votre serveur Cloud.
          </p>
          {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
          <button
            type="button"
            className="w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white"
            onClick={() => {
              setApiDown(false)
              setError(null)
              setBoot(true)
              void resolvePostLicenseStep().finally(() => setBoot(false))
            }}
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <CloudAuthContext.Provider value={authValue}>
      {!connected ? (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-clinic-50 via-[#f4f7fa] to-sky-50 p-6">
          {step === 'REGISTER_CLINIC' ? (
            <form
              onSubmit={(e) => void onRegisterClinic(e)}
              className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">Créer votre cabinet</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Initialisez l&apos;organisation et le compte administrateur propriétaire.
                </p>
                {license.licenseId ? (
                  <p className="mt-2 font-mono text-[11px] text-slate-400">
                    Licence {license.licenseId}
                  </p>
                ) : null}
              </div>
              {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}

              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cabinet</p>
              <label className="block text-xs font-medium text-slate-600">
                Nom du cabinet
                <input
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  minLength={2}
                />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600">
                  Téléphone
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600">
                  Ville
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Compte administrateur
              </p>
              <label className="block text-xs font-medium text-slate-600">
                Nom complet
                <input
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  minLength={2}
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Email professionnel
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  autoComplete="username"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Mot de passe
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Confirmer le mot de passe
                <input
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-sky-700 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? 'Création…' : 'Créer le cabinet et se connecter'}
              </button>

              <button
                type="button"
                className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:underline"
                onClick={() => {
                  setError(null)
                  setStep('LOGIN')
                }}
              >
                Déjà un compte ? Se connecter
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => void onLogin(e)}
              className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">DentiSuite</h1>
                <p className="mt-1 text-sm text-slate-500">Connexion au cabinet</p>
              </div>
              {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
              <label className="block text-xs font-medium text-slate-600">
                Username ou email
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  autoComplete="username"
                  placeholder="dr.wassim"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600">
                Mot de passe
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-sky-700 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {busy ? 'Connexion…' : 'Se connecter'}
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 text-center text-xs text-slate-500 underline-offset-2 hover:text-clinic-700 hover:underline"
                onClick={() => {
                  setError(null)
                  setStep('LICENSE_ACTIVATION')
                }}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Activer une nouvelle licence ou rejoindre un cabinet avec une clé
              </button>

              <button
                type="button"
                className="w-full text-center text-xs text-clinic-700 underline-offset-2 hover:underline"
                onClick={() => {
                  setError(null)
                  setStep('REGISTER_CLINIC')
                }}
              >
                Activer un nouveau cabinet
              </button>
            </form>
          )}
        </div>
      ) : (
        <ToastProvider>
        <div className="flex h-full bg-[#f4f7fa]">
          <GlobalSearchHost />
          <aside className="relative z-30 flex w-[272px] shrink-0 flex-col bg-clinic-950 text-white">
            <div className="border-b border-white/10 px-5 py-5">
              <Logo light name={orgLabel} src={settings?.logo} tagline="Cabinet dentaire" />
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {NAV.filter((item) => !item.perm || permissions.includes(item.perm)).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium transition ${
                      isActive
                        ? 'bg-white/12 text-white shadow-sm'
                        : 'text-clinic-100/80 hover:bg-white/6 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-white/10 p-4 space-y-2">
              <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                {settings.adminPhoto ? (
                  <img
                    src={settings.adminPhoto}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/20"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinic-500 text-sm font-semibold ring-2 ring-white/20">
                    {(
                      context?.user?.displayName ||
                      context?.user?.username ||
                      context?.user?.email ||
                      'U'
                    )
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {context?.user?.displayName ||
                      (context?.user?.username ? `@${context.user.username}` : null) ||
                      context?.user?.email ||
                      '—'}
                  </p>
                  <p className="truncate text-xs text-clinic-100/70">
                    {context?.user?.email ||
                      (context?.user?.username ? `@${context.user.username}` : '—')}
                  </p>
                  <p className="truncate text-[11px] text-clinic-100/55">
                    {(() => {
                      const role = context?.role ?? context?.membership?.role ?? ''
                      if (role === 'ADMIN') return 'Administrateur'
                      if (role === 'ASSISTANT') return 'Assistant'
                      return role || '—'
                    })()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onLogout()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          </aside>
          <div className="relative z-0 flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
              <p className="text-sm text-slate-500">{orgLabel}</p>
              <div className="flex items-center gap-3">
                <GlobalSearchTrigger />
                <p className="text-xs text-slate-400">DentiSuite Cloud</p>
              </div>
            </header>
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-clinic-50 via-[#f4f7fa] to-sky-50 p-6">
              {clinicLoading ? (
                <div className="flex h-full items-center justify-center gap-3 text-clinic-700">
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Chargement des données du cabinet…</p>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">{children ?? <Outlet />}</div>
              )}
            </main>
          </div>
        </div>
        </ToastProvider>
      )}
    </CloudAuthContext.Provider>
  )
}

/** @deprecated use CloudAppShell — kept for nested /cloud debug routes in Legacy builds */
export { CloudAppShell as CloudLayout }
