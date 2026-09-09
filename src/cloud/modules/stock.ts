import { cloudApi, asList, type CloudListResult } from '../api'

export type CloudStockItem = {
  id: string
  organizationId: string
  code: string
  name: string
  category: string
  quantity: number
  minQuantity: number
  unitPrice: number
  addedAt: string
  expiryDate: string | null
  supplier: string | null
}

export async function listStock(query: Record<string, string | number | undefined> = {}) {
  const data = await cloudApi<Partial<CloudListResult<CloudStockItem>>>({
    method: 'GET',
    path: '/stock',
    query,
  })
  return asList(data)
}

export async function createStockItem(body: Record<string, unknown>) {
  const data = await cloudApi<{ item: CloudStockItem }>({ method: 'POST', path: '/stock', body })
  return data.item
}

export async function updateStockItem(id: string, body: Record<string, unknown>) {
  const data = await cloudApi<{ item: CloudStockItem }>({
    method: 'PATCH',
    path: `/stock/${id}`,
    body,
  })
  return data.item
}

export async function deleteStockItem(id: string) {
  await cloudApi({ method: 'DELETE', path: `/stock/${id}` })
}
