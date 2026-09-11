/**
 * E2E auto-update probe via Electron CDP (installed DentiSuite).
 * Usage: node scripts/e2e-cdp-update.mjs [wsUrl]
 */
import WebSocket from 'ws'

const wsUrl =
  process.argv[2] ||
  'ws://127.0.0.1:9333/devtools/page/A919E3B852B9082C24F051E42E8AAF18'

const steps = process.argv[3] || 'check' // check | download | install | status

function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const timer = setTimeout(() => reject(new Error(`timeout ${method}`)), 120_000)
    const onMsg = (raw) => {
      const msg = JSON.parse(String(raw))
      if (msg.id === id) {
        clearTimeout(timer)
        ws.off('message', onMsg)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
    ws.on('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(ws, expression, awaitPromise = true) {
  const result = await rpc(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  })
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails))
  }
  return result.result?.value
}

async function main() {
  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  await rpc(ws, 'Runtime.enable')

  const hasApi = await evaluate(
    ws,
    `Boolean(window.dentisuite && window.dentisuite.updateCheck)`,
    false,
  )
  console.log(JSON.stringify({ hasApi }))

  if (steps === 'status' || steps === 'check') {
    const status = await evaluate(ws, `window.dentisuite.updateGetStatus()`)
    console.log(JSON.stringify({ status }))
  }

  if (steps === 'check') {
    const check = await evaluate(ws, `window.dentisuite.updateCheck({ silent: false })`)
    console.log(JSON.stringify({ check }))
  }

  if (steps === 'download') {
    const download = await evaluate(ws, `window.dentisuite.updateDownload()`)
    console.log(JSON.stringify({ download }))
  }

  if (steps === 'install') {
    const install = await evaluate(ws, `window.dentisuite.updateInstall()`)
    console.log(JSON.stringify({ install }))
  }

  ws.close()
}

main().catch((err) => {
  console.error(String(err && err.stack ? err.stack : err))
  process.exit(1)
})
