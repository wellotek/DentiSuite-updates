import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudInvoice = {
  id: string
  organizationId: string
  patientId: string
  label: string
  amount: number
  paid: boolean
  date: string
  treatmentId: string | null
}

export async function listInvoices(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudInvoice>>>({
    method: 'GET',
    path: '/invoices',
    query,
  })
  return asList(data)
}

export async function createInvoice(patientId: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ invoice: CloudInvoice }>({
    method: 'POST',
    path: `/patients/${patientId}/invoices`,
    body,
  })
  return data.invoice
}

export async function updateInvoice(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ invoice: CloudInvoice }>({
    method: 'PATCH',
    path: `/invoices/${id}`,
    body,
  })
  return data.invoice
}

export async function deleteInvoice(id: string) {
  await cloudApi({ method: 'DELETE', path: `/invoices/${id}` })
}
