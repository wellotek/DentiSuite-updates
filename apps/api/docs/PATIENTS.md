# Patients Cloud API (Phase 5A)

## Local model mapping

Current desktop `Patient` (`src/types.ts`):

| Field | Type | Cloud |
|---|---|---|
| id | string (`p{timestamp}`) | UUID |
| firstName / lastName | string | same |
| phone | string | same (search) |
| age | number | Int |
| address | string | same |
| antecedents | string | same |
| hasAllergies | boolean | same |
| dentistId? | string | optional opaque string (no Dentist FK yet) |
| teeth | Record | JSON |
| notes? | string | optional |
| email / patient number | — | **not in local model** |

Delete semantics locally: **hard delete**. Cloud matches (no soft-delete).

Search locally: name + phone. Cloud: `firstName`, `lastName`, `phone`.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/patients?search&page&limit` | `patients.read` |
| GET | `/patients/:id` | `patients.read` |
| POST | `/patients` | `patients.create` |
| PATCH | `/patients/:id` | `patients.update` |
| DELETE | `/patients/:id` | `patients.delete` |

Pipeline: authenticate → tenant → requirePermission → tenant-scoped repository.

`organizationId` is always set from membership context. Client values ignored.

## Pagination

- `page` ≥ 1 (default 1)
- `limit` 1–100 (default 20)
- Response: `{ items, page, limit, total, totalPages }`

## Errors

- `401` unauthenticated
- `403` permission / no tenant
- `404` missing or cross-tenant patient (no leak)
- `400` validation

## Security

- Never trust client `organizationId` / `userId` / `id` on create/update
- Cross-tenant id → `404`
- No Electron integration in this phase
