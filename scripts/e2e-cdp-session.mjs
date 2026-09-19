import WebSocket from 'ws'
const wsUrl = process.argv[2]
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9)
    const timer = setTimeout(() => reject(new Error('timeout '+method)), 90000)
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
const patients = await ev(ws, 'window.dentisuite.cloudPatientsList({ page: 1, limit: 5 })')
const firstId = patients?.data?.items?.[0]?.id || null
console.log(JSON.stringify({ firstId, patientCount: patients?.data?.items?.length ?? null }))
if (firstId) {
  const expr = "window.dentisuite.cloudRequest({ method: 'GET', path: '/patients/" + firstId + "/media', query: { page: 1, limit: 20 }, auth: true })"
  const media = await ev(ws, expr)
  const mItems = media?.data?.items || []
  console.log(JSON.stringify({ r2MediaOk: media?.ok, mediaStatus: media?.status, mediaCount: Array.isArray(mItems)?mItems.length:null, code: media?.code || null }))
}
const appts = await ev(ws, "window.dentisuite.cloudRequest({ method: 'GET', path: '/appointments', query: { page: 1, limit: 20 }, auth: true })")
console.log(JSON.stringify({ appointmentsOk: appts?.ok, appointmentCount: appts?.data?.items?.length ?? null, status: appts?.status }))
if (firstId) {
  const rxExpr = "window.dentisuite.cloudRequest({ method: 'GET', path: '/patients/" + firstId + "/prescriptions', query: { page: 1, limit: 20 }, auth: true })"
  const rx = await ev(ws, rxExpr)
  console.log(JSON.stringify({ rxOk: rx?.ok, rxCount: rx?.data?.items?.length ?? null, status: rx?.status }))
}
const logout = await ev(ws, 'window.dentisuite.cloudLogout()')
console.log(JSON.stringify({ logoutOk: logout?.ok }))
const afterLogout = await ev(ws, 'window.dentisuite.cloudState()')
console.log(JSON.stringify({ afterLogoutState: afterLogout?.context?.state || afterLogout?.context?.status || null, authenticated: afterLogout?.context?.authenticated ?? null }))
const restore = await ev(ws, 'window.dentisuite.cloudRestore()')
console.log(JSON.stringify({ restoreOk: restore?.ok, restoreState: restore?.context?.state || restore?.context?.status || null, org: restore?.context?.organization?.name || null, role: restore?.context?.role || restore?.context?.membership?.role || null }))
ws.close()
