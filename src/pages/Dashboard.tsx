import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarClock, PackageX, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { AppointmentStatus } from '../types'
import { formatDA } from '../lib/money'
import { addDays, toISODate } from '../lib/agenda'
import { stockAlert } from '../lib/stock'
import { isProsthesisOpen, prosthesisStatusMeta } from '../lib/prostheses'
import { useT } from '../i18n'
import { RevenueChart } from '../components/dashboard/RevenueChart'

const statusLabel: Record<AppointmentStatus, string> = {
  confirme: 'Confirmé',
  en_salle: 'En salle',
  termine: 'Terminé',
  annule: 'Annulé',
}

const statusClass: Record<AppointmentStatus, string> = {
  confirme: 'bg-sky-500/15 text-sky-800',
  en_salle: 'bg-amber-400/20 text-amber-800',
  termine: 'bg-emerald-500/15 text-emerald-800',
  annule: 'bg-slate-200 text-slate-500',
}

export function Dashboard() {
  const t = useT()
  const clinic = useAppStore((s) => s.clinic)
  const [range, setRange] = useState<'week' | 'month'>('week')
  const today = toISODate(new Date())
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  const todayAppointments = clinic.appointments.filter((a) => (a.date ?? today) === today && a.status !== 'annule')
  const inProgress = clinic.prostheses.filter(isProsthesisOpen)
  const caToday = (clinic.treatments ?? [])
    .filter((line) => line.careStatus === 'fait' && line.date === today)
    .reduce((sum, line) => sum + line.cost, 0)
  const criticalStock = (clinic.stockItems ?? []).filter((item) => {
    const alert = stockAlert(item)
    return alert === 'low' || alert === 'expired'
  }).length

  const upcoming = [...clinic.appointments]
    .filter((a) => a.status !== 'annule' && a.status !== 'termine' && a.date >= today)
    .filter((a) => a.date > today || timeToMin(a.time) >= nowMin - 15)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 6)

  const chartPoints = useMemo(() => {
    const days = range === 'week' ? 7 : 30
    return Array.from({ length: days }, (_, i) => {
      const date = addDays(new Date(), i - (days - 1))
      const iso = toISODate(date)
      const value = (clinic.treatments ?? [])
        .filter((line) => line.careStatus === 'fait' && line.date === iso)
        .reduce((sum, line) => sum + line.cost, 0)
      const visits = clinic.appointments.filter((a) => a.date === iso && a.status !== 'annule').length
      return {
        label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        value,
        visits,
      }
    })
  }, [clinic.appointments, clinic.treatments, range])

  const caRange = chartPoints.reduce((sum, p) => sum + p.value, 0)

  const cards = [
    {
      emoji: '💹',
      label: t('dashboard.ca'),
      value: formatDA(caToday),
      hint: `${t('common.today')} · ${formatDA(caRange)} ${range === 'week' ? t('common.week').toLowerCase() : t('dashboard.month').toLowerCase()}`,
      glow: 'from-emerald-400/40 to-clinic-400/20',
    },
    {
      emoji: '📅',
      label: t('dashboard.rdv'),
      value: String(todayAppointments.length),
      hint: t('dashboard.rdvHint'),
      glow: 'from-sky-400/45 to-indigo-400/15',
    },
    {
      emoji: '🦷',
      label: t('dashboard.patients'),
      value: String(clinic.patients.length),
      hint: t('dashboard.patientsHint'),
      glow: 'from-violet-400/40 to-clinic-300/20',
    },
    {
      emoji: '⚠️',
      label: t('dashboard.stock'),
      value: String(criticalStock),
      hint: t('dashboard.stockHint'),
      glow: 'from-rose-400/40 to-orange-300/20',
    },
  ]

  return (
    <div className="relative mx-auto max-w-7xl space-y-6 pb-4">
      <div className="pointer-events-none absolute -top-10 start-10 h-56 w-56 rounded-full bg-clinic-400/25 blur-3xl" style={{ animation: 'ds-glow 8s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute top-24 end-8 h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" style={{ animation: 'ds-glow 10s ease-in-out infinite' }} />
      <div className="pointer-events-none absolute bottom-10 start-1/3 h-40 w-72 rounded-full bg-sky-300/20 blur-3xl" />

      <div className="relative ds-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-clinic-800">
            <Sparkles className="h-3.5 w-3.5" />
            {clinic.settings.name}
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-clinic-950 via-clinic-700 to-emerald-600 bg-clip-text text-3xl font-semibold text-transparent">
            {t('dashboard.title')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t('dashboard.subtitle')}</p>
        </div>
        <Link
          to="/agenda"
          className="inline-flex items-center gap-1 rounded-full bg-clinic-800 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-clinic-800/20 hover:bg-clinic-900"
        >
          {t('nav.agenda')}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card, index) => (
          <article
            key={card.label}
            className="ds-glass ds-fade-up relative overflow-hidden rounded-2xl p-4"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className={`pointer-events-none absolute -end-6 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${card.glow} blur-2xl`} />
            <div className="relative flex items-start justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-lg shadow-sm ring-1 ring-white/80">
                {card.emoji}
              </span>
            </div>
            <p className="relative mt-3 text-2xl font-semibold tracking-tight text-slate-900">{card.value}</p>
            <p className="relative mt-1 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </div>

      <section className="ds-glass ds-fade-up relative overflow-hidden rounded-2xl p-5" style={{ animationDelay: '180ms' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{t('dashboard.chart')}</h2>
            <p className="text-xs text-slate-500">{t('dashboard.chartHint')}</p>
          </div>
          <div className="flex rounded-full bg-slate-100/80 p-0.5">
            <button
              type="button"
              onClick={() => setRange('week')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                range === 'week' ? 'bg-white text-clinic-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t('common.week')}
            </button>
            <button
              type="button"
              onClick={() => setRange('month')}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                range === 'month' ? 'bg-white text-clinic-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t('dashboard.month')}
            </button>
          </div>
        </div>
        <RevenueChart points={chartPoints} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="ds-glass ds-fade-up rounded-2xl p-5" style={{ animationDelay: '240ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarClock className="h-4 w-4 text-clinic-700" />
              {t('dashboard.upcoming')}
            </h2>
            <span className="text-[11px] text-slate-400">{upcoming.length}</span>
          </div>
          <ul className="space-y-2.5">
            {upcoming.map((rdv) => (
              <li
                key={rdv.id}
                className="flex items-center justify-between rounded-xl border border-white/50 bg-white/50 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{rdv.patientName}</p>
                  <p className="text-xs text-slate-500">
                    {rdv.date === today ? t('common.today') : rdv.date} · {rdv.time} · {rdv.motif}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[rdv.status]}`}>
                  {statusLabel[rdv.status]}
                </span>
              </li>
            ))}
            {upcoming.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                {t('agenda.empty')}
              </li>
            )}
          </ul>
        </section>

        <section className="ds-glass ds-fade-up rounded-2xl p-5" style={{ animationDelay: '300ms' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PackageX className="h-4 w-4 text-amber-600" />
              {t('dashboard.labs')}
            </h2>
            <Link to="/protheses" className="text-[11px] font-semibold text-clinic-700 hover:underline">
              {t('nav.prostheses')}
            </Link>
          </div>
          <ul className="space-y-2.5">
            {inProgress.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/50 bg-white/50 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{item.type}</p>
                  <p className="text-xs text-slate-500">
                    {item.patientName} · dent {item.tooth}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${prosthesisStatusMeta(item.status).className}`}>
                  {prosthesisStatusMeta(item.status).label}
                </span>
              </li>
            ))}
            {inProgress.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                {t('dashboard.labsEmpty')}
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

function timeToMin(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}
