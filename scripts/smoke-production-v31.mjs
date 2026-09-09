/**
 * Commercial smoke against Railway production (TEST fixtures only).
 * Usage: node scripts/smoke-production-v31.mjs
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
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const pass = 'SmokeTestPass123!';

const health = await req('GET', '/health');
assert(health.ok === true, 'health not ok');
console.log(`health ok v=${health.version} env=${health.env}`);

const a = await req('POST', '/auth/bootstrap-organization', {
  body: {
    licenseKey: `V31-A-${stamp}`,
    organizationName: `Cabinet V31 A ${stamp}`,
    adminEmail: `admin.a.v31.${stamp}@example.com`,
    adminPassword: pass,
    adminName: 'Admin A',
    device: { deviceIdentifier: `v31-a-${stamp}`, platform: 'win' },
  },
});
assert(a.membership?.role === 'ADMIN', 'admin role');
console.log('CREATE_CABINET=PASS');

await req('GET', '/auth/me', { token: a.token });
console.log('ADMIN_SESSION=PASS');

const asstEmail = `asst.a.v31.${stamp}@example.com`;
const team = await req('POST', '/team', {
  token: a.token,
  body: { email: asstEmail, password: 'SmokeAsstPass123!', role: 'ASSISTANT' },
});
assert(team.member?.role === 'ASSISTANT', 'assistant role');
console.log('CREATE_ASSISTANT=PASS');

const asst = await req('POST', '/auth/login', {
  body: {
    email: asstEmail,
    password: 'SmokeAsstPass123!',
    device: { deviceIdentifier: `v31-asst-${stamp}`, platform: 'win' },
  },
});
assert(Boolean(asst.token), 'assistant token missing');
const asstPerm = await req('GET', '/auth/permissions', { token: asst.token });
const adminOrgId = a.organization?.id;
assert(asstPerm.organizationId === adminOrgId, `same org expected ${adminOrgId} got ${asstPerm.organizationId}`);
assert(asstPerm.role === 'ASSISTANT', 'assistant role');
console.log(`ASSISTANT_LOGIN=PASS org=${asstPerm.organizationId} role=${asstPerm.role}`);

const pat = await req('POST', '/patients', {
  token: a.token,
  body: { firstName: 'Patient', lastName: 'V31', phone: '0644444444', age: 33 },
});
const list = await req('GET', '/patients', { token: asst.token });
assert(
  (list.items || []).some((p) => p.id === pat.patient.id),
  'assistant cannot see patient',
);
console.log('SHARED_DATA=PASS');

const b = await req('POST', '/auth/bootstrap-organization', {
  body: {
    licenseKey: `V31-B-${stamp}`,
    organizationName: `Cabinet V31 B ${stamp}`,
    adminEmail: `admin.b.v31.${stamp}@example.com`,
    adminPassword: pass,
    adminName: 'Admin B',
    device: { deviceIdentifier: `v31-b-${stamp}`, platform: 'win' },
  },
});
try {
  await req('GET', `/patients/${pat.patient.id}`, { token: b.token });
  throw new Error('cross-tenant unexpectedly allowed');
} catch (err) {
  if (err.message === 'cross-tenant unexpectedly allowed') throw err;
  if (err.status !== 404 && err.status !== 403) throw err;
  console.log(`TENANT_ISOLATION=PASS status=${err.status}`);
}

await req('POST', '/auth/logout', { token: a.token, body: {} });
try {
  await req('GET', '/auth/me', { token: a.token });
  throw new Error('logout failed');
} catch (e) {
  if (!e.status || e.status < 400) throw e;
}
console.log('LOGOUT=PASS');

const re = await req('POST', '/auth/login', {
  body: {
    email: `admin.a.v31.${stamp}@example.com`,
    password: pass,
    device: { deviceIdentifier: `v31-a-re-${stamp}`, platform: 'win' },
  },
});
const refreshed = await req('POST', '/auth/refresh', {
  token: re.token,
  body: {},
});
assert(Boolean(refreshed.token), 'refresh token missing');
console.log('SESSION_RESTORE=PASS');
console.log('COMMERCIAL_API_SMOKE=PASS');
