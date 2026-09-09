# RBAC / Permissions (Phase 4)

## Design choice: hybrid defaults

| Layer | Source of truth |
|---|---|
| Permission vocabulary | Code (`src/permissions/vocabulary.ts`) |
| ADMIN / ASSISTANT defaults | Code (same module) |
| DB `Permission` / `RolePermission` | Idempotent seed mirror (FK + future Team UI) |
| Membership overrides | Database only |

Runtime evaluation uses **code role defaults + DB overrides** (one override query). Avoids N+1 and stays versioned with the app.

## Vocabulary

`resource.action` keys — see `PERMISSIONS` in `vocabulary.ts`.

## Defaults

- **ADMIN:** all permissions
- **ASSISTANT:** clinical read/write subset (no billing.*, team.*, settings.update, audit.read, license.read, deletes, etc.)

## Override semantics

1. Membership ACTIVE + Organization ACTIVE  
2. Start from role defaults  
3. Apply overrides: `DENY` removes; `ALLOW` adds  
4. **DENY beats role ALLOW** (and replaces prior ALLOW on same key)

## Middleware pipeline

`authenticate` → `resolve tenant` → `requirePermission(key)` → handler

- `401` unauthenticated  
- `403` authenticated but denied / no tenant  

## Introspection

`GET /auth/permissions` — effective permissions for the **server-resolved** membership.  
Ignores client `role` / `organizationId` / `X-Organization-Id`.

## Security guarantees

- Never trust client `userId` / `organizationId` / `role` / permission payloads for elevation  
- No public Team mutation API in Phase 4  
- `setOverrideAsAdmin` is internal/service-only and requires ADMIN  
- ASSISTANT cannot grant itself permissions  

## Seed

```bash
npm --prefix apps/api run prisma:seed
```

Also runs on API startup. Idempotent. No users/orgs/clinical data.
