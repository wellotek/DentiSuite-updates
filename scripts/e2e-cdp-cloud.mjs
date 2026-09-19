import WebSocket from 'ws'
const wsUrl = process.argv[2]
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const timer = setTimeout(() => reject(new Error('timeout '+method)), 60000)
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
async function ev(ws, expression) {
  const result = await rpc(ws, 'Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
const ws = new WebSocket(wsUrl)
await new Promise((r,j)=>{ws.once('open',r); ws.once('error',j)})
await rpc(ws,'Runtime.enable')
const restore = await ev(ws, 'window.dentisuite.cloudRestore()')
console.log(JSON.stringify({ restoreOk: restore?.ok, state: restore?.context?.state || restore?.context?.status, org: restore?.context?.organization?.name || null, role: restore?.context?.role || restore?.context?.membership?.role || null }))
const list = await ev(ws, 'window.dentisuite.cloudPatientsList({ page: 1, limit: 20 })')
const items = list?.data?.items || list?.data?.patients || []
console.log(JSON.stringify({ patientsApiOk: list?.ok, patientCount: Array.isArray(items)?items.length:null, status: list?.status, code: list?.code || null }))
const docs = await ev(ws, `window.dentisuite.cloudRequest({ method: 'GET', path: '/patients', query: { page: 1, limit: 5 }, auth: true })`)
console.log(JSON.stringify({ supabaseProxyOk: docs?.ok, status: docs?.status }))
ws.close()
