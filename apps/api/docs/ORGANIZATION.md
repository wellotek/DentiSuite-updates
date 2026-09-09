# Organization + Membership (Phase 3)

API-only. Electron / LEGACY_LOCAL / License Manager unchanged.

## Endpoints

### POST /organization

Auth: Bearer required

Creates Organization + ADMIN Membership for `ctx.auth.userId`.

Body:

```json
{ "name": "Cabinet Dupont" }
```

Ignored if present: `userId`, `organizationId`, `licenseId`, `maxUsers`, `status`, `expiresAt`.

Response `201`:

```json
{
  "ok": true,
  "organization": { "id": "...", "name": "...", "slug": "...", "status": "ACTIVE", "...": "..." },
  "membership": { "id": "...", "role": "ADMIN", "userId": "...", "organizationId": "...", "...": "..." },
  "licenseBinding": null
}
```

Errors: `401`, `409` already in organization, `400` validation

---

### GET /organization/me

Auth: Bearer + ACTIVE membership + ACTIVE organization

Tenant is resolved **server-side** from membership.  
`X-Organization-Id` / body `organizationId` are ignored.

Response includes `auth.organizationId`, `auth.membershipId`, `auth.membershipRole`.

---

### PATCH /organization/me

Auth: Bearer + tenant + **ADMIN** role

Body: `{ "name": "New name" }`

ASSISTANT → `403 FORBIDDEN`

---

### GET /organization/me/membership

Auth: Bearer + tenant

Returns the caller's membership for the resolved organization.

## LicenseBinding

No public HTTP endpoints in Phase 3.  
Internal service: `OrganizationService.createLicenseBinding` (future License Manager).  
Does **not** call `license.dentisuite.xyz`.

## Tenant rule

`organizationId` is never trusted from the client.
