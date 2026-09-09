/**
 * DentiSuite app mode — single source of truth for CLOUD vs LEGACY.
 *
 * Resolution order:
 * 1. DENTISUITE_APP_MODE=CLOUD|LEGACY (explicit)
 * 2. DENTISUITE_CLOUD_PROBE=1 (compat alias → CLOUD)
 * 3. Packaged Electron app → CLOUD (client release default)
 * 4. Otherwise → LEGACY (local/dev fallback)
 *
 * API base resolution:
 * 1. DENTISUITE_API_BASE_URL
 * 2. userData/cloud-api.json { "apiBaseUrl": "https://..." }
 * 3. Packaged app → production HTTPS origin (never loopback)
 * 4. Unpackaged/dev → requires DENTISUITE_API_BASE_URL (npm scripts set it)
 *
 * Commercial production origin is the Railway HTTPS API (do not use loopback).
 */
'use strict'

const fs = require('fs')
const path = require('path')

/** Live commercial Cloud API (HTTPS). Never loopback. */
const PRODUCTION_API_BASE_URL = 'https://dentisuite-api-production.up.railway.app'
/** Reserved branded hostname (not used by packaged builds). */
const CANONICAL_API_BASE_URL = 'https://api.dentisuite.xyz'

function isTruthyEnv(raw) {
  const v = String(raw || '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function isPackagedApp() {
  try {
    const electron = require('electron')
    const app = electron && electron.app
    return Boolean(app && app.isPackaged)
  } catch {
    return false
  }
}

/**
 * @returns {'CLOUD' | 'LEGACY'}
 */
function getAppMode() {
  const explicit = String(process.env.DENTISUITE_APP_MODE || '')
    .trim()
    .toUpperCase()
  if (explicit === 'CLOUD') return 'CLOUD'
  if (explicit === 'LEGACY' || explicit === 'LOCAL') return 'LEGACY'

  if (isTruthyEnv(process.env.DENTISUITE_CLOUD_PROBE)) return 'CLOUD'

  if (isPackagedApp()) return 'CLOUD'

  return 'LEGACY'
}

function isCloudEnabled() {
  return getAppMode() === 'CLOUD'
}

/** @deprecated use isCloudEnabled — kept for existing call sites */
function isCloudProbeEnabled() {
  return isCloudEnabled()
}

function readUserDataApiBaseUrl() {
  try {
    const electron = require('electron')
    const app = electron && electron.app
    if (!app || typeof app.getPath !== 'function') return ''
    const file = path.join(app.getPath('userData'), 'cloud-api.json')
    if (!fs.existsSync(file)) return ''
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw)
    const url = parsed && typeof parsed.apiBaseUrl === 'string' ? parsed.apiBaseUrl.trim() : ''
    return url ? url.replace(/\/$/, '') : ''
  } catch {
    return ''
  }
}

function getApiBaseUrl() {
  const fromEnv = String(process.env.DENTISUITE_API_BASE_URL || '').trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const fromFile = readUserDataApiBaseUrl()
  if (fromFile) return fromFile
  if (isPackagedApp()) return PRODUCTION_API_BASE_URL
  // Unpackaged Cloud without override: empty — npm scripts must set DENTISUITE_API_BASE_URL.
  return ''
}

function getCloudConfig() {
  const appMode = getAppMode()
  const cloud = appMode === 'CLOUD'
  return {
    appMode,
    cloudMode: cloud,
    probeEnabled: cloud,
    apiBaseUrl: getApiBaseUrl(),
    productionApiBaseUrl: PRODUCTION_API_BASE_URL,
    canonicalApiBaseUrl: CANONICAL_API_BASE_URL,
  }
}

module.exports = {
  PRODUCTION_API_BASE_URL,
  CANONICAL_API_BASE_URL,
  getAppMode,
  isCloudEnabled,
  isCloudProbeEnabled,
  isPackagedApp,
  getApiBaseUrl,
  getCloudConfig,
}
