/**
 * Desktop auto-update via electron-updater → public GitHub releases repo.
 * Feed: wellotek/DentiSuite-updates (binaries only — no source, no secrets).
 * Never embeds a GitHub token. Packaged builds only.
 */
const { app, ipcMain, BrowserWindow } = require('electron')

const UPDATES_OWNER = 'wellotek'
const UPDATES_REPO = 'DentiSuite-updates'

/** @type {'idle'|'checking'|'available'|'not-available'|'downloading'|'ready'|'error'} */
let status = 'idle'
let lastError = null
/** @type {null | { version: string, releaseName?: string, releaseDate?: string }} */
let availableInfo = null
let downloadPercent = 0
let started = false

function getAutoUpdater() {
  // Lazy require so unpackaged / missing dep does not crash startup.
  // eslint-disable-next-line global-require
  const { autoUpdater } = require('electron-updater')
  return autoUpdater
}

function snapshot() {
  return {
    status,
    currentVersion: app.getVersion(),
    availableVersion: availableInfo?.version ?? null,
    releaseName: availableInfo?.releaseName ?? null,
    releaseDate: availableInfo?.releaseDate ?? null,
    downloadPercent,
    error: lastError,
    packaged: app.isPackaged,
    feed: {
      provider: 'github',
      owner: UPDATES_OWNER,
      repo: UPDATES_REPO,
    },
  }
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload)
    }
  }
}

function setStatus(next, extra = {}) {
  status = next
  const body = { ...snapshot(), ...extra }
  broadcast('update:status', body)
  return body
}

function configureUpdater() {
  const autoUpdater = getAutoUpdater()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false
  autoUpdater.allowPrerelease = false
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: UPDATES_OWNER,
    repo: UPDATES_REPO,
  })

  autoUpdater.on('checking-for-update', () => {
    lastError = null
    setStatus('checking')
  })

  autoUpdater.on('update-available', (info) => {
    availableInfo = {
      version: info.version,
      releaseName: info.releaseName,
      releaseDate: info.releaseDate ? String(info.releaseDate) : undefined,
    }
    setStatus('available', { info: availableInfo })
    broadcast('update:available', availableInfo)
  })

  autoUpdater.on('update-not-available', () => {
    availableInfo = null
    setStatus('not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    downloadPercent = Math.round(Number(progress.percent) || 0)
    setStatus('downloading', { progress })
    broadcast('update:progress', { percent: downloadPercent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    downloadPercent = 100
    availableInfo = {
      version: info.version,
      releaseName: info.releaseName,
      releaseDate: info.releaseDate ? String(info.releaseDate) : undefined,
    }
    setStatus('ready')
    broadcast('update:downloaded', availableInfo)
  })

  autoUpdater.on('error', (err) => {
    lastError = err && err.message ? String(err.message) : String(err)
    setStatus('error')
    broadcast('update:error', { message: lastError })
  })

  return autoUpdater
}

function registerUpdateIpc() {
  if (started) return
  started = true

  ipcMain.handle('update:getStatus', () => snapshot())

  ipcMain.handle('update:check', async (_event, options = {}) => {
    if (!app.isPackaged) {
      return setStatus('not-available', {
        error: null,
        note: 'Updates are only checked in packaged builds',
      })
    }
    try {
      const autoUpdater = configureUpdater()
      lastError = null
      setStatus('checking')
      const result = await autoUpdater.checkForUpdates()
      return {
        ...snapshot(),
        updateInfo: result?.updateInfo
          ? { version: result.updateInfo.version }
          : null,
        silent: Boolean(options.silent),
      }
    } catch (err) {
      lastError = err && err.message ? String(err.message) : String(err)
      return setStatus('error')
    }
  })

  ipcMain.handle('update:download', async () => {
    if (!app.isPackaged) {
      return setStatus('error', { error: 'Not packaged' })
    }
    try {
      const autoUpdater = configureUpdater()
      downloadPercent = 0
      setStatus('downloading')
      await autoUpdater.downloadUpdate()
      return snapshot()
    } catch (err) {
      lastError = err && err.message ? String(err.message) : String(err)
      return setStatus('error')
    }
  })

  ipcMain.handle('update:install', () => {
    if (!app.isPackaged) {
      return { ok: false, error: 'Not packaged' }
    }
    try {
      const autoUpdater = configureUpdater()
      // isSilent=false, isForceRunAfter=true
      autoUpdater.quitAndInstall(false, true)
      return { ok: true }
    } catch (err) {
      lastError = err && err.message ? String(err.message) : String(err)
      setStatus('error')
      return { ok: false, error: lastError }
    }
  })
}

/**
 * Silent check a few seconds after launch (packaged only).
 */
function scheduleSilentCheck(delayMs = 8000) {
  if (!app.isPackaged) return
  setTimeout(() => {
    try {
      configureUpdater()
      getAutoUpdater()
        .checkForUpdates()
        .catch(() => {
          /* errors already emitted via 'error' */
        })
    } catch {
      /* ignore */
    }
  }, delayMs)
}

module.exports = {
  registerUpdateIpc,
  scheduleSilentCheck,
  UPDATES_OWNER,
  UPDATES_REPO,
}
