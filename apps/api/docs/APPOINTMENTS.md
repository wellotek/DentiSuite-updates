# Appointments Cloud API (Phase 5B)

## Local model mapping

From `src/types.ts` + agenda/store:

| Field | Local | Cloud |
|---|---|---|
| id | `a{timestamp}` | UUID |
| date | `YYYY-MM-DD` string | `DATE` / API `YYYY-MM-DD` |
| time | `HH:mm` string | same (wall-clock, not TZ-converted) |
| durationMin | number | Int (1–1440) |
| patientId | string | UUID FK → Patient (same org) |
| patientName / patientPhone | denormalized | snapshotted from Patient on create/update |
| motif | string | same |
| practitioner | string | same |
| dentistId? | opaque | opaque (no Dentist FK) |
| status | confirme / en_salle / termine / annule | same |
| category | urgence / consultation / controle / soin / extraction / prothese | same |

No end datetime field locally — length is `durationMin` only.  
No recurrence / conflict engine.  
**Hard delete** (matches local store).

## Date/time strategy

- **date**: civil calendar day as `YYYY-MM-DD` (stored as Postgres `DATE`)
- **time**: local clinic wall-clock `HH:mm` (not rewritten to UTC instants)
- Range filter uses calendar days (`from` ≤ `to`)
- Invalid date/time/range → `400`

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/appointments` | `appointments.read` |
| GET | `/appointments/:id` | `appointments.read` |
| POST | `/appointments` | `appointments.create` |
| PATCH | `/appointments/:id` | `appointments.update` |
| DELETE | `/appointments/:id` | `appointments.delete` |

Query: `date`, `from`, `to`, `patientId`, `dentistId`, `status`, `page`, `limit` (max 100).

## Tenant / relation safety

- `organizationId` always from membership
- `patientId` must resolve with `{ id, organizationId }` — otherwise **404**
- Cross-tenant appointment id → **404**

## Pipeline

authenticate → tenant → requirePermission → tenant-scoped repository
