/**
 * Controlled Phase 1 soft-archive smoke against Railway production.
 * Creates a disposable org + patient only — never touches pilot patients.
 * Usage: node scripts/smoke-phase1-archive-prod.mjs
 */
const BASE = 'https://dentisuite-api-production.up.railway.app';

async function req(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const pass = 'SmokePhase1Pass123!';

const health = await req('GET', '/health');
assert(health.ok && health.json?.ok === true, `health failed ${health.status}`);
console.log(`HEALTH=PASS v=${health.json.version} env=${health.json.env}`);

const boot = await req('POST', '/auth/bootstrap-organization', {
  body: {
    licenseKey: `P1-ARCH-${stamp}`,
    organizationName: `Phase1 Archive Smoke ${stamp}`,
    adminEmail: `p1.archive.${stamp}@example.com`,
    adminPassword: pass,
    adminName: 'P1 Admin',
    device: { deviceIdentifier: `p1-arch-${stamp}`, platform: 'win' },
  },
});
assert(boot.ok, `bootstrap failed ${boot.status} ${JSON.stringify(boot.json)}`);
const token = boot.json.token;
assert(Boolean(token), 'missing token');
console.log('BOOTSTRAP=PASS');

const created = await req('POST', '/patients', {
  token,
  body: { firstName: 'Archive', lastName: `Smoke${stamp}`, phone: '0600000099', age: 40 },
});
assert(created.ok, `create patient failed ${created.status}`);
const patientId = created.json.patient?.id;
assert(Boolean(patientId), 'missing patient id');
console.log(`CREATE_PATIENT=PASS id=${patientId}`);

const del = await req('DELETE', `/patients/${patientId}`, { token });
assert(del.status === 200, `archive DELETE status=${del.status} body=${JSON.stringify(del.json)}`);
assert(del.json?.archived === true, 'archived flag missing');
assert(Boolean(del.json?.patient?.archivedAt), 'archivedAt missing after archive');
console.log('ARCHIVE_ENDPOINT=PASS');

const list = await req('GET', '/patients?limit=100', { token });
assert(list.ok, `list failed ${list.status}`);
assert(!(list.json.items || []).some((p) => p.id === patientId), 'archived patient still in default list');
console.log('LIST_EXCLUDES_ARCHIVED=PASS');

const listedArchived = await req('GET', '/patients?includeArchived=true&limit=100', { token });
assert(listedArchived.ok, `includeArchived list failed ${listedArchived.status}`);
assert(
  (listedArchived.json.items || []).some((p) => p.id === patientId),
  'archived patient missing from includeArchived list',
);
console.log('INCLUDE_ARCHIVED=PASS');

const getArchived = await req('GET', `/patients/${patientId}`, { token });
assert(getArchived.ok, `GET archived patient failed ${getArchived.status}`);
assert(Boolean(getArchived.json.patient?.archivedAt), 'GET should keep archived patient + history access');
console.log('GET_ARCHIVED_KEEPS_HISTORY=PASS');

const restore = await req('POST', `/patients/${patientId}/restore`, { token });
assert(restore.status === 200, `restore status=${restore.status} body=${JSON.stringify(restore.json)}`);
assert(restore.json.patient?.archivedAt == null, 'archivedAt should be null after restore');
console.log('RESTORE_ENDPOINT=PASS');

const listAfter = await req('GET', '/patients?limit=100', { token });
assert((listAfter.json.items || []).some((p) => p.id === patientId), 'restored patient missing from list');
console.log('RESTORE_VISIBLE=PASS');

// Probe purge route presence without leaving orphan if it works — disposable smoke patient only.
const purge = await req('POST', `/patients/${patientId}/purge`, { token });
assert(purge.status === 200, `purge status=${purge.status} body=${JSON.stringify(purge.json)}`);
assert(purge.json?.purged === true, 'purged flag missing');
const getGone = await req('GET', `/patients/${patientId}`, { token });
assert(getGone.status === 404, `expected 404 after purge, got ${getGone.status}`);
console.log('PURGE_ENDPOINT=PASS (disposable smoke patient only)');

const unauth = await req('DELETE', `/patients/${patientId}`);
assert(unauth.status === 401 || unauth.status === 404, `RBAC/auth expected 401/404 got ${unauth.status}`);
console.log('RBAC_UNAUTH=PASS');

const other = await req('POST', '/auth/bootstrap-organization', {
  body: {
    licenseKey: `P1-OTHER-${stamp}`,
    organizationName: `Phase1 Other Org ${stamp}`,
    adminEmail: `p1.other.${stamp}@example.com`,
    adminPassword: pass,
    adminName: 'Other Admin',
    device: { deviceIdentifier: `p1-other-${stamp}`, platform: 'win' },
  },
});
assert(other.ok, `other org bootstrap failed ${other.status}`);
const ghost = await req('GET', `/patients/${patientId}`, { token: other.json.token });
assert(ghost.status === 404 || ghost.status === 403, `cross-tenant expected 404/403 got ${ghost.status}`);
console.log('MULTI_TENANT=PASS');

console.log('PHASE1_PROD_SMOKE=PASS');
