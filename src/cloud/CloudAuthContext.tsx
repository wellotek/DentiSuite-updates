import { createContext, useContext } from 'react'
import type { CloudSessionContext } from './types'

export type CloudAuthContextValue = {
  context: CloudSessionContext | null
  connected: boolean
  permissions: string[]
  hasPermission: (key: string) => boolean
  refreshSession: () => Promise<void>
  reload: () => void
}

export const CloudAuthContext = createContext<CloudAuthContextValue | null>(null)

export function useCloudAuth() {
  const ctx = useContext(CloudAuthContext)
  if (!ctx) throw new Error('useCloudAuth requires CloudLayout')
  return ctx
}
