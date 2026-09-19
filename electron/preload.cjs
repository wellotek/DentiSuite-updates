const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dentisuite', {
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: (licenseId, activationCode) =>
    ipcRenderer.invoke('license:activate', { licenseId, activationCode }),
  retryLicense: () => ipcRenderer.invoke('license:retry'),
  getClinic: () => ipcRenderer.invoke('clinic:get'),
  setClinic: (clinic) => ipcRenderer.invoke('clinic:set', clinic),
  getBranding: () => ipcRenderer.invoke('branding:get'),
  setBranding: (branding) => ipcRenderer.invoke('branding:set', branding),
  saveMedia: (input) => ipcRenderer.invoke('media:save', input),
  readMedia: (input) => ipcRenderer.invoke('media:read', input),
  deleteMedia: (input) => ipcRenderer.invoke('media:delete', input),
  // Phase 7A — Cloud probe (no raw token returned)
  cloudConfig: () => ipcRenderer.invoke('cloud:config'),
  cloudHasSession: () => ipcRenderer.invoke('cloud:hasSession'),
  cloudLogin: (email, password) => ipcRenderer.invoke('cloud:login', { email, password }),
  cloudBootstrapOrganization: (payload) =>
    ipcRenderer.invoke('cloud:bootstrapOrganization', payload || {}),
  cloudOnboardingStatus: (licenseKey) =>
    ipcRenderer.invoke('cloud:onboardingStatus', { licenseKey }),
  cloudLogout: () => ipcRenderer.invoke('cloud:logout'),
  cloudRestore: () => ipcRenderer.invoke('cloud:restore'),
  cloudState: () => ipcRenderer.invoke('cloud:state'),
  cloudRequest: (input) => ipcRenderer.invoke('cloud:request', input),
  // Phase 8A — Patients Cloud list (no token, no orgId override)
  cloudPatientsList: (query) => ipcRenderer.invoke('cloud:patients:list', query || {}),
  // Phase 8B — Patients Cloud create (POST only via this channel)
  cloudPatientsCreate: (input) => ipcRenderer.invoke('cloud:patients:create', input || {}),
  // Phase 8C — Patients Cloud update (PATCH only via this channel)
  cloudPatientsUpdate: (input) => ipcRenderer.invoke('cloud:patients:update', input || {}),
  // Auto-update (electron-updater → wellotek/DentiSuite-updates)
  updateGetStatus: () => ipcRenderer.invoke('update:getStatus'),
  updateCheck: (options) => ipcRenderer.invoke('update:check', options || {}),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('update:status', listener)
    ipcRenderer.on('update:available', () => undefined)
    return () => {
      ipcRenderer.removeListener('update:status', listener)
    }
  },
})
