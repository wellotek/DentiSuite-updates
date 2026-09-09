/**
 * Dev-only Vite renderer URL helpers.
 * Excluded from the commercial Electron package (see package.json build.files).
 */
'use strict'

const DEFAULT_DEV_RENDERER_URL = 'http://127.0.0.1:5173'

function getDevRendererUrl() {
  const fromEnv = String(process.env.VITE_DEV_SERVER_URL || '').trim()
  return fromEnv || DEFAULT_DEV_RENDERER_URL
}

function isAllowedDevNavigation(url) {
  const base = getDevRendererUrl()
  return (
    url.startsWith(base) ||
    url.startsWith('http://127.0.0.1:5173') ||
    url.startsWith('http://localhost:5173') ||
    url.startsWith('file://')
  )
}

module.exports = {
  getDevRendererUrl,
  isAllowedDevNavigation,
}
