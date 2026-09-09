const { app, safeStorage } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function idPath() {
  return path.join(app.getPath('userData'), 'installation.id.enc')
}

function getInstallationId() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage unavailable')
  }
  const file = idPath()
  if (fs.existsSync(file)) {
    try {
      const existing = safeStorage.decryptString(fs.readFileSync(file)).trim()
      if (existing) return existing
    } catch {
      /* regenerate if the blob cannot be decrypted */
    }
  }
  const id = crypto.randomUUID()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, safeStorage.encryptString(id))
  return id
}

module.exports = { getInstallationId }
