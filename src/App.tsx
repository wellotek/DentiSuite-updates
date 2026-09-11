import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useAppStore } from './store/useAppStore'
import { AppLayout } from './components/layout/AppLayout'
import { ActivateLicense } from './pages/ActivateLicense'
import { Dashboard } from './pages/Dashboard'
import { Patients } from './pages/Patients'
import { PatientChart } from './pages/PatientChart'
import { Agenda } from './pages/Agenda'
import { Prostheses } from './pages/Prostheses'
import { Finances } from './pages/Finances'
import { Practitioners } from './pages/Practitioners'
import { Settings } from './pages/Settings'
import { Stock } from './pages/Stock'
import { Prescriptions } from './pages/Prescriptions'
import { CloudAppShell } from './pages/cloud/CloudAppShell'
import { CloudTeamPage } from './pages/cloud/CloudTeamPage'
import { CloudDocumentsPage } from './pages/cloud/CloudDocumentsPage'
import { useT } from './i18n'
import { readCloudConfig } from './cloud/bridge'
import { UpdateNotifier } from './components/UpdateNotifier'

/**
 * CLOUD product routes: full Legacy UI under Cloud auth shell.
 * Simplified Cloud* prototype pages are no longer the commercial navigation.
 */
function CloudRoutes() {
  return (
    <Routes>
      <Route element={<CloudAppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientChart />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/appointments" element={<Navigate to="/agenda" replace />} />
        <Route path="/praticiens" element={<Practitioners />} />
        <Route path="/dentists" element={<Navigate to="/praticiens" replace />} />
        <Route path="/protheses" element={<Prostheses />} />
        <Route path="/prostheses" element={<Navigate to="/protheses" replace />} />
        <Route path="/ordonnances" element={<Prescriptions />} />
        <Route path="/prescriptions" element={<Navigate to="/ordonnances" replace />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/billing" element={<Navigate to="/finances" replace />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="/documents" element={<CloudDocumentsPage />} />
        <Route path="/team" element={<CloudTeamPage />} />
        <Route path="/clinical" element={<Navigate to="/patients" replace />} />
        <Route path="/treatments" element={<Navigate to="/patients" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function LegacyRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/:id" element={<PatientChart />} />
        <Route path="/agenda" element={<Agenda />} />
        <Route path="/praticiens" element={<Practitioners />} />
        <Route path="/protheses" element={<Prostheses />} />
        <Route path="/ordonnances" element={<Prescriptions />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/parametres" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const hydrated = useAppStore((s) => s.hydrated)
  const licenseActivated = useAppStore((s) => s.license.activated)
  const hydrate = useAppStore((s) => s.hydrate)
  const locale = useAppStore((s) => s.clinic.settings?.locale ?? 'fr')
  const t = useT()
  const [appMode, setAppMode] = useState<'CLOUD' | 'LEGACY' | null>(null)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    let cancelled = false
    void readCloudConfig().then((cfg) => {
      if (!cancelled) setAppMode(cfg.appMode === 'CLOUD' || cfg.cloudMode ? 'CLOUD' : 'LEGACY')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'ar' ? 'ar' : 'fr'
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  if (!hydrated || !appMode) {
    return (
      <div className="flex h-full items-center justify-center bg-clinic-50">
        <div className="flex flex-col items-center gap-3 text-clinic-700">
          <LoaderCircle className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <UpdateNotifier mode="prompt" />
      {appMode === 'CLOUD' ? (
        <CloudRoutes />
      ) : !licenseActivated ? (
        <Routes>
          <Route path="*" element={<ActivateLicense />} />
        </Routes>
      ) : (
        <LegacyRoutes />
      )}
    </HashRouter>
  )
}
