const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const licenseService = require('./license/service.cjs')
const { registerCloudIpc } = require('./cloud/ipc.cjs')
const { registerUpdateIpc, scheduleSilentCheck } = require('./updater.cjs')
const path = require('path')
const fs = require('fs')
const os = require('os')

function crashLogPath() {
  try {
    if (app.isReady()) return path.join(app.getPath('desktop'), 'dentisuite-crash.log')
  } catch {
    /* app pas encore prêt */
  }
  const home = os.homedir()
  for (const folder of ['Desktop', 'Bureau']) {
    const dir = path.join(home, folder)
    try {
      if (fs.existsSync(dir)) return path.join(dir, 'dentisuite-crash.log')
    } catch {
      /* ignore */
    }
  }
  return path.join(home, 'dentisuite-crash.log')
}

function logCrash(type, error) {
  const stack = error instanceof Error ? error.stack : String(error)
  const line = `[${new Date().toISOString()}] ${type}: ${stack}\n`
  try {
    fs.appendFileSync(crashLogPath(), line, 'utf-8')
  } catch {
    try {
      fs.appendFileSync(path.join(os.homedir(), 'dentisuite-crash.log'), line, 'utf-8')
    } catch {
      /* dernier recours : ne pas rethrow */
    }
  }
}

process.on('uncaughtException', (error) => {
  logCrash('uncaughtException', error)
})
process.on('unhandledRejection', (reason) => {
  logCrash('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)))
})

const DEFAULT_ZOOM = 1.2
const MIN_ZOOM = 0.8
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

let lastZoomAt = 0

function storePath() {
  return path.join(app.getPath('userData'), 'dentisuite-store.json')
}

function defaultStore() {
  return {
    clinic: null,
    branding: { logo: '', adminPhoto: '' },
    zoomFactor: DEFAULT_ZOOM,
  }
}

function withoutAuth(data) {
  if (!data || typeof data !== 'object') return data
  const next = { ...data }
  delete next.auth
  return next
}

function clampZoom(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(n * 100) / 100))
}

function readZoom() {
  return clampZoom(readStore().zoomFactor ?? DEFAULT_ZOOM)
}

function persistZoom(factor) {
  const store = readStore()
  store.zoomFactor = clampZoom(factor)
  writeStore(store)
}

function applyZoom(win, factor) {
  if (!win || win.isDestroyed()) return
  const next = clampZoom(factor)
  win.webContents.setZoomFactor(next)
  persistZoom(next)
}

function zoomBy(win, delta) {
  if (!win || win.isDestroyed()) return
  const now = Date.now()
  if (now - lastZoomAt < 50) return
  lastZoomAt = now
  applyZoom(win, win.webContents.getZoomFactor() + delta)
}

function zoomReset(win) {
  applyZoom(win, DEFAULT_ZOOM)
}

function isZoomModifier(input) {
  return Boolean(input.control || input.meta) && !input.alt
}

function handleZoomShortcut(win, input) {
  if (input.type !== 'keyDown' || !isZoomModifier(input)) return false

  const { key, code } = input
  const zoomIn =
    key === '+' ||
    key === '=' ||
    code === 'Equal' ||
    code === 'NumpadAdd' ||
    code === 'NumpadEqual'
  const zoomOut = key === '-' || key === '_' || code === 'Minus' || code === 'NumpadSubtract'
  const reset = key === '0' || code === 'Digit0' || code === 'Numpad0'

  if (zoomIn) {
    zoomBy(win, ZOOM_STEP)
    return true
  }
  if (zoomOut) {
    zoomBy(win, -ZOOM_STEP)
    return true
  }
  if (reset) {
    zoomReset(win)
    return true
  }
  return false
}

function buildAppMenu() {
  const viewMenu = {
    label: 'Affichage',
    submenu: [
      {
        label: 'Zoom avant',
        accelerator: 'CmdOrCtrl+Plus',
        click: (_item, win) => zoomBy(win ?? BrowserWindow.getFocusedWindow(), ZOOM_STEP),
      },
      {
        label: 'Zoom avant',
        accelerator: 'CmdOrCtrl+=',
        visible: false,
        acceleratorWorksWhenHidden: true,
        click: (_item, win) => zoomBy(win ?? BrowserWindow.getFocusedWindow(), ZOOM_STEP),
      },
      {
        label: 'Zoom arrière',
        accelerator: 'CmdOrCtrl+-',
        click: (_item, win) => zoomBy(win ?? BrowserWindow.getFocusedWindow(), -ZOOM_STEP),
      },
      {
        label: 'Taille par défaut',
        accelerator: 'CmdOrCtrl+0',
        click: (_item, win) => zoomReset(win ?? BrowserWindow.getFocusedWindow()),
      },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' },
      { role: 'reload', label: 'Recharger' },
    ],
  }

  const template =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about', label: 'À propos de DentiSuite' },
              { type: 'separator' },
              { role: 'hide', label: 'Masquer' },
              { role: 'hideOthers', label: 'Masquer les autres' },
              { role: 'unhide', label: 'Afficher tout' },
              { type: 'separator' },
              { role: 'quit', label: 'Quitter' },
            ],
          },
          viewMenu,
        ]
      : [viewMenu]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    const hadAuth = parsed && Object.prototype.hasOwnProperty.call(parsed, 'auth')
    const store = withoutAuth({ ...defaultStore(), ...parsed })
    if (hadAuth) writeStoreUnlocked(store)
    return store
  } catch {
    return defaultStore()
  }
}

function writeStoreUnlocked(data) {
  const file = storePath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // Write via temp + replace to avoid truncated JSON if the process dies mid-write.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(withoutAuth(data), null, 2), 'utf-8')
  try {
    fs.renameSync(tmp, file)
  } catch {
    // Windows cannot rename over an existing file — replace explicitly.
    try {
      fs.unlinkSync(file)
    } catch {
      /* first write */
    }
    fs.renameSync(tmp, file)
  }
}

/** Serialize all store mutations — concurrent clinic:set + branding:set was wiping patients. */
let storeWriteChain = Promise.resolve()

function withStoreLock(fn) {
  const run = storeWriteChain.then(() => fn())
  storeWriteChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function writeStore(data) {
  try {
    writeStoreUnlocked(data)
  } catch (error) {
    logCrash('writeStore', error)
    throw error
  }
}

function createWindow() {
  const initialZoom = readZoom()
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.ico')
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: 'DentiSuite',
    backgroundColor: '#f4f7fa',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      zoomFactor: initialZoom,
    },
  })

  win.once('ready-to-show', () => {
    win.webContents.setZoomFactor(initialZoom)
    win.show()
  })
  win.setMenuBarVisibility(false)

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(readZoom())
  })

  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    logCrash('did-fail-load', new Error(`${code} ${desc} ${url}`))
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (handleZoomShortcut(win, input)) event.preventDefault()
  })

  win.webContents.on('zoom-changed', (_event, direction) => {
    zoomBy(win, direction === 'in' ? ZOOM_STEP : -ZOOM_STEP)
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (app.isPackaged) {
      if (!url.startsWith('file://')) event.preventDefault()
      return
    }
    try {
      const { isAllowedDevNavigation } = require('./dev-renderer-url.cjs')
      if (!isAllowedDevNavigation(url)) event.preventDefault()
    } catch {
      if (!url.startsWith('file://')) event.preventDefault()
    }
  })

  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }, 4000)

  if (!app.isPackaged) {
    try {
      const { getDevRendererUrl } = require('./dev-renderer-url.cjs')
      win.loadURL(getDevRendererUrl())
    } catch (err) {
      logCrash('dev-renderer-url', err)
    }
  } else {
    const indexHtml = path.join(__dirname, '..', 'dist', 'index.html')
    if (!fs.existsSync(indexHtml)) {
      logCrash('startup', new Error(`index.html introuvable: ${indexHtml}`))
    }
    win.loadFile(indexHtml)
  }
}

app.whenReady().then(() => {
  buildAppMenu()

  ipcMain.handle('license:status', () => licenseService.getLicenseStatus())
  ipcMain.handle('license:activate', (_event, payload) => {
    const licenseId = payload && payload.licenseId
    const activationCode = payload && payload.activationCode
    return licenseService.activateLicense(licenseId, activationCode)
  })
  ipcMain.handle('license:retry', () => licenseService.retryLicense())

  // Cloud auth IPC (token stays in main / safeStorage). Active when APP_MODE=CLOUD.
  registerCloudIpc()
  // Desktop auto-update (packaged builds → public GitHub updates repo).
  registerUpdateIpc()
  scheduleSilentCheck(8000)

  ipcMain.handle('clinic:get', () => {
    return readStore().clinic
  })

  ipcMain.handle('clinic:set', async (_event, clinic) => {
    // Cloud mode: Legacy JSON is not the business source of truth.
    // Still allow writes for Legacy fallback / local settings recovery tools.
    const { isCloudEnabled: cloudOn } = require('./cloud/config.cjs')
    if (cloudOn()) {
      // Do not persist cloud UUIDs into Legacy store — strip common cloud id shapes if present
      // by refusing wholesale clinic replacement from renderer when Cloud is primary.
      // Local Legacy recovery still works with APP_MODE=LEGACY.
      // Branding (logo / admin photo) still persists via branding:set.
      return { ok: false, code: 'CLOUD_MODE', message: 'Legacy clinic JSON is read-only in Cloud mode' }
    }
    try {
      await withStoreLock(() => {
        const store = readStore()
        store.clinic = clinic
        // Keep branding mirror in sync when Legacy clinic settings include images.
        if (clinic && clinic.settings && typeof clinic.settings === 'object') {
          store.branding = {
            logo: typeof clinic.settings.logo === 'string' ? clinic.settings.logo : '',
            adminPhoto: typeof clinic.settings.adminPhoto === 'string' ? clinic.settings.adminPhoto : '',
          }
        }
        writeStore(store)
      })
      return { ok: true }
    } catch (error) {
      logCrash('clinic:set', error)
      return {
        ok: false,
        code: 'WRITE_FAILED',
        message: error instanceof Error ? error.message : 'Clinic store write failed',
      }
    }
  })

  /** Branding assets — writable in Legacy AND Cloud (clinic:set is blocked in Cloud). */
  ipcMain.handle('branding:get', () => {
    const store = readStore()
    const b = store.branding && typeof store.branding === 'object' ? store.branding : {}
    return {
      logo: typeof b.logo === 'string' ? b.logo : '',
      adminPhoto: typeof b.adminPhoto === 'string' ? b.adminPhoto : '',
    }
  })

  ipcMain.handle('branding:set', async (_event, branding) => {
    try {
      await withStoreLock(() => {
        const store = readStore()
        store.branding = {
          logo: branding && typeof branding.logo === 'string' ? branding.logo : '',
          adminPhoto: branding && typeof branding.adminPhoto === 'string' ? branding.adminPhoto : '',
        }
        writeStore(store)
      })
      return { ok: true }
    } catch (error) {
      logCrash('branding:set', error)
      return {
        ok: false,
        code: 'WRITE_FAILED',
        message: error instanceof Error ? error.message : 'Branding store write failed',
      }
    }
  })

  ipcMain.handle('media:save', (_event, payload) => {
    try {
      const patientId = payload && payload.patientId
      const fileId = payload && payload.fileId
      const name = payload && payload.name
      const dataBase64 = payload && payload.dataBase64
      const safeId = String(patientId || '').replace(/[^a-zA-Z0-9_-]/g, '')
      const safeFileId = String(fileId || '').replace(/[^a-zA-Z0-9_-]/g, '')
      if (!safeId) return { ok: false, error: 'patient' }
      if (!safeFileId) return { ok: false, error: 'save' }
      const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.dcm', '.dicom'])
      const rawExt = path.extname(String(name || '')).toLowerCase()
      const ext = allowed.has(rawExt) ? rawExt : ''
      const filename = `${safeFileId}${ext}`
      const dir = path.join(app.getPath('userData'), 'media', safeId)
      fs.mkdirSync(dir, { recursive: true })
      const dest = path.resolve(dir, filename)
      const rel = path.relative(dir, dest)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return { ok: false, error: 'path' }
      const buf = Buffer.from(String(dataBase64 || ''), 'base64')
      if (!buf.length) return { ok: false, error: 'empty' }
      if (buf.length > 80 * 1024 * 1024) return { ok: false, error: 'too_large' }
      fs.writeFileSync(dest, buf)
      return { ok: true, filename }
    } catch (error) {
      const code = error && error.code ? String(error.code) : ''
      if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: 'folder' }
      return { ok: false, error: 'save' }
    }
  })

  ipcMain.handle('media:read', (_event, { patientId, filename }) => {
    try {
      const dir = path.join(app.getPath('userData'), 'media', String(patientId).replace(/[^a-zA-Z0-9_-]/g, ''))
      const safe = path.basename(String(filename || ''))
      const dest = path.resolve(dir, safe)
      const rel = path.relative(dir, dest)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null
      return fs.readFileSync(dest).toString('base64')
    } catch {
      return null
    }
  })

  ipcMain.handle('media:delete', (_event, { patientId, filename }) => {
    try {
      const dir = path.join(app.getPath('userData'), 'media', String(patientId).replace(/[^a-zA-Z0-9_-]/g, ''))
      const safe = path.basename(String(filename || ''))
      const dest = path.resolve(dir, safe)
      const rel = path.relative(dir, dest)
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return
      fs.unlinkSync(dest)
    } catch {
      /* ignore */
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((error) => {
  logCrash('whenReady', error)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
