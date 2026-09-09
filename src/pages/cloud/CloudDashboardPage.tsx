import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileText, Package, Users, Wallet } from 'lucide-react'
import { listCloudPatients } from '../../cloud/modules/patients'
import { listAppointments } from '../../cloud/modules/appointments'
import { listInvoices } from '../../cloud/modules/billing'
import { listStock } from '../../cloud/modules/stock'
import { useCloudAuth } from '../../cloud/CloudAuthContext'
import { CloudBanner, CloudLoading, CloudSyncBar, formatCloudError, todayIso } from './ui'
import { useCloudLiveSync } from '../../cloud/useCloudLiveSync'

type Stats = {
  patients: number
  appointmentsToday: number
  unpaidInvoices: number
  stockItems: number
}

export function CloudDashboardPage() {
  const { context, permissions, hasPermission } = useCloudAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const today = todayIso()
  const permKey = permissions.join(',')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const can = (key: string) => permissions.includes(key)
      const [patients, appts, invoices, stock] = await Promise.all([
        can('patients.read')
          ? listCloudPatients({ page: 1, limit: 1 })
          : Promise.resolve({ total: 0, items: [], page: 1, limit: 1, totalPages: 0 }),
        can('appointments.read')
          ? listAppointments({ date: today, page: 1, limit: 100 })
          : Promise.resolve({ total: 0, items: [], page: 1, limit: 100, totalPages: 0 }),
        can('billing.read')
          ? listInvoices({ page: 1, limit: 100 })
          : Promise.resolve({ total: 0, items: [], page: 1, limit: 100, totalPages: 0 }),
        can('stock.read')
          ? listStock({ page: 1, limit: 1 })
          : Promise.resolve({ total: 0, items: [], page: 1, limit: 1, totalPages: 0 }),
      ])
      setStats({
        patients: patients.total,
        appointmentsToday: appts.items.filter((a) => a.status !== 'annule').length,
        unpaidInvoices: invoices.items.filter((i) => !i.paid).length,
        stockItems: stock.total,
      })
    } catch (err) {
      setError(formatCloudError(err))
    } finally {
      setLoading(false)
    }
  }, [permKey, permissions, today])

  useEffect(() => {
    void load()
  }, [load])

  const { lastSyncedAt, syncing, refresh } = useCloudLiveSync({
    reload: load,
    enabled: true,
    pollIntervalMs: 30_000,
    poll: true,
  })

  const cards = stats
    ? [
        {
          to: '/patients',
          label: 'Patients',
          value: String(stats.patients),
          icon: Users,
          show: hasPermission('patients.read'),
        },
        {
          to: '/appointments',
          label: 'RDV du jour',
          value: String(stats.appointmentsToday),
          icon: CalendarDays,
          show: hasPermission('appointments.read'),
        },
        {
          to: '/billing',
          label: 'Factures ouvertes',
          value: String(stats.unpaidInvoices),
          icon: Wallet,
          show: hasPermission('billing.read'),
        },
        {
          to: '/stock',
          label: 'Articles stock',
          value: String(stats.stockItems),
          icon: Package,
          show: hasPermission('stock.read'),
        },
      ].filter((c) => c.show)
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord</h1>
          <p className="mt-1 text-sm text-slate-500">
            {context?.organization?.name ?? 'Cabinet'} · {today}
          </p>
        </div>
        <CloudSyncBar
          lastSyncedAt={lastSyncedAt}
          syncing={syncing}
          onRefresh={() => void refresh()}
        />
      </div>
      {error ? <CloudBanner kind="error">{error}</CloudBanner> : null}
      {loading && !stats ? (
        <CloudLoading />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
                <c.icon className="h-4 w-4 text-sky-700" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-900">{c.value}</p>
            </Link>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Accès rapide</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { to: '/patients', label: 'Patients', perm: 'patients.read' },
            { to: '/appointments', label: 'Agenda', perm: 'appointments.read' },
            { to: '/documents', label: 'Documents', perm: 'documents.read' },
            { to: '/prescriptions', label: 'Ordonnances', perm: 'prescriptions.read' },
            { to: '/team', label: 'Équipe', perm: 'team.read' },
          ]
            .filter((l) => hasPermission(l.perm))
            .map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {l.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  )
}
