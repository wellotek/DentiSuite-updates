import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Stethoscope,
  Users,
  Wallet,
} from 'lucide-react'
import { Logo } from '../Logo'
import { useAppStore } from '../../store/useAppStore'
import { formatClinicDate, formatClinicTime, useT } from '../../i18n'
import { seedClinic } from '../../data/seed'
import { useEffect, useState } from 'react'
import { ToastProvider } from '../ui/Toast'
import { GlobalSearchHost, GlobalSearchTrigger } from '../search/GlobalSearch'

const ToothIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2c-2.4 0-4.3 1.7-4.8 4-.6 2.6.2 5.2 1.1 7.6.6 1.6 1.2 3.2 1.2 4.9 0 1.4.8 2.5 2.5 2.5s2.5-1.1 2.5-2.5c0-1.7.6-3.3 1.2-4.9.9-2.4 1.7-5 1.1-7.6C16.3 3.7 14.4 2 12 2z" />
  </svg>
)

/** Legacy Local shell — used only when APP_MODE=LEGACY. */
export function AppLayout() {
  const t = useT()
  const settings = useAppStore((s) => s.clinic.settings) ?? seedClinic.settings
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const navItems = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/patients', label: t('nav.patients'), icon: Users },
    { to: '/agenda', label: t('nav.agenda'), icon: CalendarDays },
    { to: '/praticiens', label: t('nav.dentists'), icon: Stethoscope },
    { to: '/protheses', label: t('nav.prostheses'), icon: ToothIcon },
    { to: '/ordonnances', label: t('nav.prescriptions'), icon: FileText },
    { to: '/stock', label: t('nav.stock'), icon: Package },
    { to: '/finances', label: t('nav.finances'), icon: Wallet },
    { to: '/parametres', label: t('nav.settings'), icon: Settings },
  ]

  return (
    <ToastProvider>
    <div className="flex h-full bg-[#f4f7fa]">
      <GlobalSearchHost />
      <aside
        className="relative z-30 flex w-[272px] shrink-0 flex-col bg-clinic-950 text-white"
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'none'
        }}
        onDrop={(e) => e.preventDefault()}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <Logo light name={settings.name} src={settings.logo} tagline={settings.address} />
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
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

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            {settings.adminPhoto ? (
              <img
                src={settings.adminPhoto}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinic-500 text-sm font-semibold ring-2 ring-white/20">
                {(settings.name || 'D').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{settings.name || 'DentiSuite'}</p>
              <p className="truncate text-xs text-clinic-100/70">{settings.email || '—'}</p>
              <p className="truncate text-[11px] text-clinic-100/55">Administrateur</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="relative z-0 flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6">
          <p className="text-sm capitalize text-slate-500">
            {formatClinicDate(now, settings)} · {formatClinicTime(now, settings)}
          </p>
          <div className="flex items-center gap-3">
            <GlobalSearchTrigger />
            <p className="text-xs text-slate-500">{settings.name}</p>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-clinic-50 via-[#f4f7fa] to-sky-50 p-6">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ToastProvider>
  )
}
