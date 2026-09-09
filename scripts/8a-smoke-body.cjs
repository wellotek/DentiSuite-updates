'use strict'

/**
 * Cloud business modules smoke — login + multi-module CRUD via Main (no BrowserWindow).
 * Never prints secrets. Pilot org only.
 */
module.exports = async function runSmokeBody(app) {
  const fs = require('fs')
  const path = require('path')

  const OUT =
    process.env.DENTISUITE_7A_OUT ||
    path.join(process.cwd(), 'tmp', '7a-electron-validation', 'smoke-final-report.json')
  const EXPECTED_ORG = 'ac3d519a-b1cd-4926-9c12-c6721c6e9907'
  const SMOKE_PATIENT = 'f0778efe-2277-4f75-ba3a-c0f8d4c5c026'
  const TAG = `SMOKE/TEST ${new Date().toISOString().slice(0, 10)}`

  function writeReport(report) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  }

  function maskEmail(email) {
    if (!email || typeof email !== 'string') return null
    const [u, d] = email.split('@')
    if (!d) return '***'
    return `${u.slice(0, 2)}***@${d}`
  }

  function todayIso() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const report = {
    title: 'DENTISUITE CLOUD RELEASE SMOKE',
    producedAt: new Date().toISOString(),
    userData: app.getPath('userData'),
    secretsExposed: false,
    steps: {},
  }

  let email = process.env.DENTISUITE_7A_EMAIL || ''
  let password = process.env.DENTISUITE_7A_PASSWORD || ''
  const credsFile = process.env.DENTISUITE_7A_CREDS_FILE
  if ((!email || !password) && credsFile && fs.existsSync(credsFile)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'))
      email = String(creds.email || email)
      password = String(creds.password || password)
    } catch {
      /* ignore */
    }
  }

  try {
    process.env.DENTISUITE_APP_MODE = 'CLOUD'
    process.env.DENTISUITE_CLOUD_PROBE = '1'
    if (!process.env.DENTISUITE_API_BASE_URL) {
      process.env.DENTISUITE_API_BASE_URL = 'http://127.0.0.1:3001'
    }

    if (!email || !password) {
      report.verdict = 'NOT_READY'
      report.error = 'Missing credentials'
      writeReport(report)
      app.exit(1)
      return
    }

    const { getCloudConfig } = require('../electron/cloud/config.cjs')
    const session = require('../electron/cloud/session.cjs')
    const { cloudFetch } = require('../electron/cloud/api-proxy.cjs')
    const sessionManager = require('../electron/cloud/session-manager.cjs')
    const { containsSecretLeak } = require('../electron/cloud/redact.cjs')
    const { listPatients, createPatient, updatePatient } = require('../electron/cloud/patients.cjs')
    const { assertCloudPathAllowed, scrubCloudBody } = require('../electron/cloud/allowlist.cjs')

    report.steps.featureFlag = getCloudConfig()
    report.steps.cloudMode = getCloudConfig().cloudMode === true

    // Allowlist guards
    let allowOk = true
    let denyOk = false
    try {
      assertCloudPathAllowed('GET', '/appointments')
      assertCloudPathAllowed('POST', '/dentists')
      assertCloudPathAllowed('DELETE', `/patients/${SMOKE_PATIENT}`)
    } catch {
      allowOk = false
    }
    try {
      assertCloudPathAllowed('POST', '/admin')
    } catch {
      denyOk = true
    }
    const scrubbed = scrubCloudBody({ a: 1, organizationId: 'evil', token: 'x' })
    report.steps.allowlist = {
      ok: allowOk && denyOk && !('organizationId' in scrubbed) && !('token' in scrubbed),
      allowOk,
      denyOk,
    }

    sessionManager.clear()
    const loginCtx = await sessionManager.login(email, password)
    report.steps.cloudLogin = {
      ok: loginCtx.state === 'AUTHENTICATED',
      userEmailMasked: maskEmail(loginCtx.user?.email || email),
      tokenReturnedToCaller: Object.prototype.hasOwnProperty.call(loginCtx, 'token'),
      secretLeak: containsSecretLeak(loginCtx),
    }
    report.steps.organization = {
      ok: loginCtx.organization?.id === EXPECTED_ORG,
      id: loginCtx.organization?.id || null,
    }
    const perms = loginCtx.permissions?.permissions || []
    report.steps.permissions = {
      ok: Array.isArray(perms) && perms.includes('patients.read'),
      count: perms.length,
    }

    // Patients read/create/update
    const beforePatients = await listPatients({ page: 1, limit: 100 })
    const updated = await updatePatient(SMOKE_PATIENT, {
      notes: TAG,
      phone: '0555FINAL42',
      organizationId: 'evil-org',
    })
    report.steps.patientsUpdate = {
      ok:
        updated.patient?.id === SMOKE_PATIENT &&
        updated.patient.organizationId === EXPECTED_ORG &&
        updated.patient.phone === '0555FINAL42',
      id: updated.patient?.id || null,
    }
    const createdPatient = await createPatient({
      firstName: 'TEST',
      lastName: `FINAL${Date.now().toString().slice(-4)}`,
      phone: '0555FINAL99',
      age: 33,
      notes: TAG,
      organizationId: 'evil-org',
    })
    report.steps.patientsCreate = {
      ok:
        Boolean(createdPatient.patient?.id) &&
        createdPatient.patient.organizationId === EXPECTED_ORG,
      id: createdPatient.patient?.id || null,
    }
    const afterPatients = await listPatients({ page: 1, limit: 100 })
    report.steps.patientsRead = {
      ok: afterPatients.total >= beforePatients.total && afterPatients.items.some((p) => p.id === SMOKE_PATIENT),
      total: afterPatients.total,
    }

    const patientId = SMOKE_PATIENT
    const date = todayIso()

    // Appointments
    const apptCreate = await cloudFetch({
      method: 'POST',
      path: '/appointments',
      auth: true,
      body: {
        date,
        time: '11:30',
        durationMin: 30,
        patientId,
        motif: TAG,
        practitioner: 'Dr SMOKE',
        status: 'confirme',
        category: 'consultation',
        organizationId: 'evil',
      },
    })
    const apptId = apptCreate.data?.appointment?.id
    const apptPatch = apptId
      ? await cloudFetch({
          method: 'PATCH',
          path: `/appointments/${apptId}`,
          auth: true,
          body: { status: 'termine' },
        })
      : { status: 0 }
    const apptList = await cloudFetch({
      method: 'GET',
      path: '/appointments',
      query: { date, limit: 50 },
      auth: true,
    })
    report.steps.appointments = {
      ok:
        apptCreate.status < 300 &&
        Boolean(apptId) &&
        apptPatch.status < 300 &&
        apptList.status === 200 &&
        Array.isArray(apptList.data?.items),
      createStatus: apptCreate.status,
      patchStatus: apptPatch.status,
      id: apptId || null,
    }

    // Clinical
    const consult = await cloudFetch({
      method: 'POST',
      path: `/patients/${patientId}/consultations`,
      auth: true,
      body: { date, time: '10:00', teeth: ['16'], acts: TAG, notes: TAG },
    })
    const treat = await cloudFetch({
      method: 'POST',
      path: `/patients/${patientId}/treatments`,
      auth: true,
      body: {
        date,
        tooth: '16',
        act: TAG,
        code: 'SMOKE',
        cost: 1500,
        careStatus: 'a_faire',
        paymentStatus: 'en_attente',
      },
    })
    const consultList = await cloudFetch({
      method: 'GET',
      path: `/patients/${patientId}/consultations`,
      query: { limit: 20 },
      auth: true,
    })
    report.steps.clinical = {
      ok: consult.status < 300 && treat.status < 300 && consultList.status === 200,
      consultStatus: consult.status,
      treatStatus: treat.status,
    }

    // Prescriptions
    const rx = await cloudFetch({
      method: 'POST',
      path: `/patients/${patientId}/prescriptions`,
      auth: true,
      body: {
        date,
        title: TAG,
        lines: [{ drug: 'Paracetamol SMOKE', posology: '1g x3', duration: '3j' }],
      },
    })
    const rxList = await cloudFetch({
      method: 'GET',
      path: `/patients/${patientId}/prescriptions`,
      query: { limit: 20 },
      auth: true,
    })
    report.steps.prescriptions = {
      ok: rx.status < 300 && rxList.status === 200 && Boolean(rx.data?.prescription?.id),
      status: rx.status,
      id: rx.data?.prescription?.id || null,
    }

    // Dentists
    const dentist = await cloudFetch({
      method: 'POST',
      path: '/dentists',
      auth: true,
      body: {
        firstName: 'TEST',
        lastName: `SMOKE${Date.now().toString().slice(-4)}`,
        specialty: 'Omnipratique',
        color: '#0ea5e9',
        organizationId: 'evil',
      },
    })
    const dentistId = dentist.data?.dentist?.id
    const dentistPatch = dentistId
      ? await cloudFetch({
          method: 'PATCH',
          path: `/dentists/${dentistId}`,
          auth: true,
          body: { specialty: 'Omnipratique SMOKE' },
        })
      : { status: 0 }
    const dentistsList = await cloudFetch({ method: 'GET', path: '/dentists', query: { limit: 50 }, auth: true })
    report.steps.dentists = {
      ok:
        dentist.status < 300 &&
        dentist.data?.dentist?.organizationId === EXPECTED_ORG &&
        dentistPatch.status < 300 &&
        dentistsList.status === 200,
      id: dentistId || null,
      createStatus: dentist.status,
    }

    // Billing
    const invoice = await cloudFetch({
      method: 'POST',
      path: `/patients/${patientId}/invoices`,
      auth: true,
      body: { label: TAG, amount: 3500, paid: false, date },
    })
    const invoiceId = invoice.data?.invoice?.id
    const invoicePatch = invoiceId
      ? await cloudFetch({
          method: 'PATCH',
          path: `/invoices/${invoiceId}`,
          auth: true,
          body: { paid: true },
        })
      : { status: 0 }
    const invoicesList = await cloudFetch({ method: 'GET', path: '/invoices', query: { limit: 50 }, auth: true })
    report.steps.billing = {
      ok: invoice.status < 300 && invoicePatch.status < 300 && invoicesList.status === 200,
      id: invoiceId || null,
      createStatus: invoice.status,
    }

    // Stock
    const stock = await cloudFetch({
      method: 'POST',
      path: '/stock',
      auth: true,
      body: {
        code: `SMK${Date.now().toString().slice(-6)}`,
        name: TAG,
        category: 'consommable',
        quantity: 5,
        minQuantity: 1,
        unitPrice: 100,
        addedAt: date,
      },
    })
    const stockId = stock.data?.item?.id
    const stockPatch = stockId
      ? await cloudFetch({
          method: 'PATCH',
          path: `/stock/${stockId}`,
          auth: true,
          body: { quantity: 6 },
        })
      : { status: 0 }
    const stockList = await cloudFetch({ method: 'GET', path: '/stock', query: { limit: 50 }, auth: true })
    report.steps.stock = {
      ok: stock.status < 300 && stockPatch.status < 300 && stockList.status === 200,
      id: stockId || null,
      createStatus: stock.status,
    }

    // Prostheses
    const prosthesis = await cloudFetch({
      method: 'POST',
      path: `/patients/${patientId}/prostheses`,
      auth: true,
      body: {
        type: TAG,
        tooth: '16',
        lab: 'Lab SMOKE',
        sentAt: date,
        status: 'envoye',
      },
    })
    const prosthesisId = prosthesis.data?.prosthesis?.id
    const prosthesisPatch = prosthesisId
      ? await cloudFetch({
          method: 'PATCH',
          path: `/prostheses/${prosthesisId}`,
          auth: true,
          body: { status: 'fabrication' },
        })
      : { status: 0 }
    const prosthesisList = await cloudFetch({
      method: 'GET',
      path: '/prostheses',
      query: { limit: 50 },
      auth: true,
    })
    report.steps.prostheses = {
      ok: prosthesis.status < 300 && prosthesisPatch.status < 300 && prosthesisList.status === 200,
      id: prosthesisId || null,
      createStatus: prosthesis.status,
    }

    // Documents / media — full R2 signed upload E2E (bytes via PUT, no creds to renderer)
    const mediaList = await cloudFetch({
      method: 'GET',
      path: `/patients/${patientId}/media`,
      query: { limit: 20 },
      auth: true,
    })
    const PNG_1X1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    let mediaE2E = {
      ok: false,
      listStatus: mediaList.status,
      createStatus: 0,
      putStatus: 0,
      completeStatus: 0,
      downloadStatus: 0,
      downloadBytes: 0,
      deleteStatus: 0,
      secretsInPayload: false,
      mediaId: null,
    }
    try {
      const mediaCreate = await cloudFetch({
        method: 'POST',
        path: `/patients/${patientId}/media`,
        auth: true,
        body: {
          title: 'SMOKE-RELEASE.png',
          kind: 'image',
          mime: 'image/png',
          originalName: 'SMOKE-RELEASE.png',
          size: PNG_1X1.length,
        },
      })
      mediaE2E.createStatus = mediaCreate.status
      mediaE2E.secretsInPayload = containsSecretLeak(mediaCreate.data)
      const upload = mediaCreate.data?.upload
      const mediaId = mediaCreate.data?.media?.id
      mediaE2E.mediaId = mediaId || null
      if (mediaCreate.status < 300 && upload?.url && mediaId) {
        const putRes = await fetch(upload.url, {
          method: upload.method || 'PUT',
          headers: upload.headers || { 'Content-Type': 'image/png' },
          body: PNG_1X1,
        })
        mediaE2E.putStatus = putRes.status
        if (putRes.ok) {
          const completed = await cloudFetch({
            method: 'POST',
            path: `/media/${mediaId}/complete`,
            auth: true,
            body: {},
          })
          mediaE2E.completeStatus = completed.status
          if (completed.status < 300) {
            const dl = await cloudFetch({
              method: 'GET',
              path: `/media/${mediaId}/url`,
              auth: true,
            })
            mediaE2E.downloadStatus = dl.status
            if (dl.status === 200 && (dl.data?.downloadUrl || dl.data?.url)) {
              const fileUrl = dl.data.downloadUrl || dl.data.url
              const got = await fetch(fileUrl)
              const buf = Buffer.from(await got.arrayBuffer())
              mediaE2E.downloadBytes = buf.length
              mediaE2E.downloadHttp = got.status
              mediaE2E.ok =
                got.ok &&
                buf.length >= PNG_1X1.length &&
                mediaList.status === 200 &&
                !mediaE2E.secretsInPayload
            }
            const del = await cloudFetch({
              method: 'DELETE',
              path: `/media/${mediaId}`,
              auth: true,
            })
            mediaE2E.deleteStatus = del.status
          }
        }
      }
    } catch (err) {
      mediaE2E.putStatus = err && err.status ? err.status : mediaE2E.putStatus
      mediaE2E.ok = false
      mediaE2E.error = err instanceof Error ? err.message : String(err)
    }
    report.steps.documents = mediaE2E

    // Cross-tenant body scrub verified via create responses using EXPECTED_ORG
    report.steps.tenantIsolation = {
      ok:
        updated.patient.organizationId === EXPECTED_ORG &&
        createdPatient.patient.organizationId === EXPECTED_ORG &&
        (!dentist.data?.dentist || dentist.data.dentist.organizationId === EXPECTED_ORG),
    }

    await sessionManager.logout()
    report.steps.logout = { ok: !session.hasSession() }

    const login2 = await sessionManager.login(email, password)
    report.steps.relogin = {
      ok: login2.state === 'AUTHENTICATED',
      tokenReturnedToCaller: Object.prototype.hasOwnProperty.call(login2, 'token'),
    }

    const rawBefore = session.readSession()
    const ctx2 = await sessionManager.restore()
    report.steps.restartSessionRestore = {
      ok: Boolean(rawBefore?.token) && ctx2.state === 'AUTHENTICATED',
      contextState: ctx2.state,
    }

    const listAfter = await listPatients({ page: 1, limit: 20 })
    report.steps.patientsAfterRestore = {
      ok: listAfter.items.some((p) => p.id === SMOKE_PATIENT),
      total: listAfter.total,
    }

    const clinicPath = path.join(app.getPath('userData'), 'dentisuite-store.json')
    let clinicHasToken = false
    let clinicHasCloudUuid = false
    if (fs.existsSync(clinicPath)) {
      const raw = fs.readFileSync(clinicPath, 'utf8')
      clinicHasToken = Boolean(rawBefore?.token) && raw.includes(rawBefore.token)
      clinicHasCloudUuid = raw.includes(SMOKE_PATIENT)
    }
    report.steps.localJson = {
      pathExists: fs.existsSync(clinicPath),
      tokenInClinicJson: clinicHasToken,
      cloudUuidWritten: clinicHasCloudUuid,
      ok: !clinicHasToken && !clinicHasCloudUuid,
    }

    const checks = [
      report.steps.featureFlag?.probeEnabled === true,
      report.steps.featureFlag?.cloudMode === true,
      report.steps.featureFlag?.appMode === 'CLOUD',
      report.steps.cloudMode === true,
      report.steps.allowlist?.ok,
      report.steps.cloudLogin?.ok,
      report.steps.cloudLogin?.tokenReturnedToCaller === false,
      report.steps.cloudLogin?.secretLeak === false,
      report.steps.organization?.ok,
      report.steps.permissions?.ok,
      report.steps.patientsRead?.ok,
      report.steps.patientsCreate?.ok,
      report.steps.patientsUpdate?.ok,
      report.steps.appointments?.ok,
      report.steps.clinical?.ok,
      report.steps.prescriptions?.ok,
      report.steps.dentists?.ok,
      report.steps.billing?.ok,
      report.steps.stock?.ok,
      report.steps.prostheses?.ok,
      report.steps.documents?.ok,
      report.steps.tenantIsolation?.ok,
      report.steps.logout?.ok,
      report.steps.relogin?.ok,
      report.steps.restartSessionRestore?.ok,
      report.steps.patientsAfterRestore?.ok,
      report.steps.localJson?.ok,
    ]
    report.verdict = checks.every(Boolean) ? 'READY_FOR_RELEASE' : 'NOT_READY'
    writeReport(report)

    if (credsFile && fs.existsSync(credsFile) && /creds\.smoke-run\.json$/i.test(credsFile)) {
      try {
        fs.unlinkSync(credsFile)
      } catch {
        /* ignore */
      }
    }
    password = ''
    app.exit(report.verdict === 'READY_FOR_RELEASE' ? 0 : 1)
  } catch (error) {
    report.verdict = 'NOT_READY'
    report.error = {
      message: error instanceof Error ? error.message : String(error),
      code: error && error.code ? error.code : null,
      status: error && error.status ? error.status : null,
      phase: 'body-catch',
    }
    writeReport(report)
    password = ''
    app.exit(1)
  }
}
