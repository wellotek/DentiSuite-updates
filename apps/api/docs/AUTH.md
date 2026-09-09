# DentiSuite API — Authentication (Phase 2)

API-only. Electron / LEGACY_LOCAL / License Manager are unchanged.

## Base URL

`http://127.0.0.1:3001`

Authorization (authenticated routes):

```http
Authorization: Bearer <opaque-token>
```

## Endpoints

### POST /auth/register

Auth: none (rate-limited)

Body:

```json
{ "email": "user@example.com", "password": "SecurePass1!" }
```

Response `201`:

```json
{
  "ok": true,
  "user": { "id": "...", "email": "user@example.com", "status": "ACTIVE", "organizationId": null, "membershipId": null, "...": "..." },
  "organization": null,
  "membership": null,
  "message": "Account created. No organization is linked yet. ..."
}
```

Errors: `400` validation, `409` email taken, `429` rate limit

---

### POST /auth/login

Auth: none (rate-limited)

Body:

```json
{
  "email": "user@example.com",
  "password": "SecurePass1!",
  "device": { "deviceIdentifier": "install-uuid", "platform": "windows", "name": "Clinic PC" }
}
```

`device` is optional.

Response `200`: `{ ok, token, expiresAt, user, organization: null, membership: null }`

Errors: `401` AUTH_FAILED (generic), `429`

---

### POST /auth/logout

Auth: Bearer required (idempotent if already revoked)

Response `200`: `{ ok: true }`

---

### POST /auth/refresh

Auth: Bearer + rate limit

Extends session `expiresAt`. Returns the **same** opaque token (no rotation in Phase 2).

Response `200`: `{ ok, token, expiresAt, user, organization: null, membership: null }`

---

### GET /auth/me

Auth: Bearer

Response `200`: `{ ok, user, auth: { userId, sessionId, deviceId }, organization: null, membership: null }`

---

### POST /auth/change-password

Auth: Bearer + rate limit

Body: `{ "currentPassword": "...", "newPassword": "..." }`

Policy: updates hash; **revokes all other sessions**; keeps current session.

---

### POST /auth/revoke-session

Auth: Bearer

Body: `{ "sessionId": "<uuid>" }` — own sessions only

---

### POST /auth/revoke-device

Auth: Bearer

Body: `{ "deviceId": "<uuid>" }` — own devices only; revokes device + its sessions

---

### GET /auth/sessions

Auth: Bearer — lists caller sessions only

### GET /auth/devices

Auth: Bearer — lists caller devices only

## Security notes

- Passwords: Argon2id (`@node-rs/argon2`)
- Tokens: 256-bit opaque bearer; DB stores SHA-256 `tokenHash` only
- Disabled users cannot login / refresh / use existing sessions
- In-memory rate limit is single-process only
