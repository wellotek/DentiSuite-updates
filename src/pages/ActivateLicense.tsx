import { FormEvent, useEffect, useState } from 'react'
import { KeyRound, LoaderCircle, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'

type Mode = 'status' | 'form'

export function ActivateLicense({ onActivated }: { onActivated?: () => void } = {}) {
  const t = useT()
  const license = useAppStore((s) => s.license)
  const activate = useAppStore((s) => s.activateLicense)
  const applyLicenseStatus = useAppStore((s) => s.applyLicenseStatus)
  const retryLicense = useAppStore((s) => s.retryLicense)
  const [licenseId, setLicenseId] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>(() =>
    license.screen === 'blocked' || license.screen === 'offline' ? 'status' : 'form',
  )

  const needsStatus = license.screen === 'blocked' || license.screen === 'offline'
  const showForm = mode === 'form' || !needsStatus

  useEffect(() => {
    if (license.screen === 'activate') setMode('form')
    if (license.screen === 'blocked' || license.screen === 'offline') {
      setMode((current) => (current === 'form' ? 'form' : 'status'))
      setError(null)
    }
  }, [license.screen])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    const result = await activate(licenseId, activationCode)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? t('license.invalid'))
      return
    }
    setSuccess(t('license.success'))
    window.setTimeout(() => {
      if (result.status) applyLicenseStatus(result.status)
      onActivated?.()
    }, 900)
  }

  async function onRetry() {
    setError(null)
    setSuccess(null)
    setLoading(true)
    const status = await retryLicense()
    setLoading(false)
    if (status.activated) {
      applyLicenseStatus(status)
      onActivated?.()
      return
    }
    setError(status.message ?? (status.screen === 'offline' ? t('license.online') : t('license.revoked')))
    setMode('status')
  }

  function openReplaceForm() {
    setError(null)
    setSuccess(null)
    setLicenseId('')
    setActivationCode('')
    setMode('form')
  }

  const statusMessage =
    error ||
    license.message ||
    (license.screen === 'blocked' ? t('license.revoked') : t('license.online'))

  return (
    <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,_#d9ecf5_0%,_#f4f7fa_55%,_#e8eef3_100%)] p-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex justify-center">
          <Logo name="DentiSuite V8" tagline={t('license.product')} />
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
          <div className="mb-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-clinic-700">
              DentiSuite V8
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">
              {showForm ? t('license.title') : t('license.statusTitle')}
            </h1>
            {showForm && <p className="mt-1 text-sm text-slate-500">{t('license.subtitle')}</p>}
          </div>

          {needsStatus && mode === 'status' && (
            <div className="space-y-4">
              <p
                className={`rounded-lg px-3 py-2.5 text-sm ${
                  license.screen === 'offline'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {statusMessage}
              </p>

              {license.licenseId && (
                <p className="text-center font-mono text-[11px] tracking-wide text-slate-400">
                  {t('license.currentId')}: {license.licenseId}
                </p>
              )}

              <button
                type="button"
                onClick={() => void onRetry()}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinic-700 py-2.5 text-sm font-semibold text-white transition hover:bg-clinic-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {loading ? t('license.retrying') : t('license.retry')}
              </button>

              <button
                type="button"
                onClick={openReplaceForm}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {t('license.replace')}
              </button>
            </div>
          )}

          {showForm && (
            <form onSubmit={onSubmit} className="space-y-4">
              {needsStatus && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {t('license.replaceHint')}
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('license.id')}</span>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    value={licenseId}
                    onChange={(e) => setLicenseId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 font-mono text-sm uppercase tracking-wide outline-none transition focus:border-clinic-400 focus:bg-white focus:ring-2 focus:ring-clinic-100"
                    placeholder="DS-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={loading || Boolean(success)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-600">{t('license.code')}</span>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 font-mono text-sm uppercase tracking-wide outline-none transition focus:border-clinic-400 focus:bg-white focus:ring-2 focus:ring-clinic-100"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={loading || Boolean(success)}
                  />
                </div>
              </label>

              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
              {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{success}</p>}

              <button
                type="submit"
                disabled={loading || !licenseId.trim() || !activationCode.trim() || Boolean(success)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-clinic-700 py-2.5 text-sm font-semibold text-white transition hover:bg-clinic-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {loading ? t('license.loading') : t('license.submit')}
              </button>

              {needsStatus && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setSuccess(null)
                    setMode('status')
                  }}
                  disabled={loading || Boolean(success)}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('license.backStatus')}
                </button>
              )}
            </form>
          )}
        </div>

        <div className="mt-6 space-y-2 text-center">
          <a
            href="mailto:support@dentisuite.xyz?subject=DentiSuite%20V8%20-%20Licence"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-clinic-700 hover:underline"
          >
            <Mail className="h-3.5 w-3.5" />
            {t('license.contact')}
          </a>
          <p className="text-[11px] text-slate-400">{t('license.support')}</p>
        </div>
      </div>
    </div>
  )
}
