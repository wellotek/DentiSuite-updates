/**
 * Phase 8A Electron validation smoke (headless Main path).
 * Patients Cloud READ ONLY. Token stays in main safeStorage. Never prints secrets.
 *
 * Prefer: scripts/8a-electron-smoke.cjs
 * This file remains as a compatibility entry that delegates to the same body.
 *
 * Env:
 *   DENTISUITE_CLOUD_PROBE=1
 *   DENTISUITE_API_BASE_URL=http://127.0.0.1:3001
 *   DENTISUITE_7A_EMAIL / DENTISUITE_7A_PASSWORD or DENTISUITE_7A_CREDS_FILE
 *   DENTISUITE_7A_USER_DATA (isolated userData path)
 *   DENTISUITE_7A_OUT (report json path)
 */
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const userData = process.env.DENTISUITE_7A_USER_DATA
if (userData) {
  fs.mkdirSync(userData, { recursive: true })
  app.setPath('userData', userData)
}

const OUT =
  process.env.DENTISUITE_7A_OUT ||
  path.join(process.cwd(), 'tmp', '7a-electron-validation', 'smoke-report.json')

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  path.join(path.dirname(OUT), 'smoke-boot.json'),
  JSON.stringify({ boot: true, at: new Date().toISOString(), entry: '7a-electron-smoke.cjs' }),
)

async function main() {
  const runSmokeBody = require('./8a-smoke-body.cjs')
  await runSmokeBody(app)
}

app.whenReady().then(() => main()).catch((error) => {
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      title: 'PHASE 8A PATIENTS CLOUD READ-ONLY SMOKE',
      verdict: 'NOT_READY',
      error: { message: String(error), phase: 'whenReady' },
    }, null, 2),
  )
  app.exit(1)
})
