const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const userData = process.env.DENTISUITE_7A_USER_DATA
if (userData) {
  fs.mkdirSync(userData, { recursive: true })
  app.setPath('userData', userData)
}

const markerDir = path.join(process.cwd(), 'tmp', '7a-electron-validation')
fs.mkdirSync(markerDir, { recursive: true })
fs.writeFileSync(
  path.join(markerDir, 'smoke8a-boot.json'),
  JSON.stringify({ boot: true, at: new Date().toISOString(), entry: '8a-electron-smoke.cjs' }),
)

async function main() {
  const runSmokeBody = require('./8a-smoke-body.cjs')
  await runSmokeBody(app)
}

app.whenReady().then(() => main()).catch((error) => {
  const out =
    process.env.DENTISUITE_7A_OUT || path.join(markerDir, 'smoke-8a-report.json')
  fs.writeFileSync(
    out,
    JSON.stringify({
      title: 'PHASE 8A PATIENTS CLOUD READ-ONLY SMOKE',
      verdict: 'NOT_READY',
      error: { message: String(error), phase: 'whenReady' },
    }, null, 2),
  )
  app.exit(1)
})
