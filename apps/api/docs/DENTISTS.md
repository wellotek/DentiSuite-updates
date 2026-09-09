# Dentists Cloud API (Phase 5E)

## Local audit

`Dentist` in `src/types.ts` / `clinic.dentists`:

| Field | Type | Notes |
|---|---|---|
| id | `d{timestamp}` | |
| firstName | string | |
| lastName | string | |
| specialty | string | e.g. Omnipratique |
| photo | string | data URL or `''` |
| color | string | hex agenda color |

**Not present locally:** userId, email, phone, status, availability, schedule, specialty enum table.

Display name is computed: `Dr. ${firstName} ${lastName}` (`lib/dentists.ts`).

### Usage

- Patient.dentistId (treating dentist, optional)
- Appointment.dentistId + practitioner (denormalized name)
- Prescription.dentistId + dentistName
- ClinicalSession / Treatment: **no** dentist field

### Deletion (local)

Hard delete. Clears `dentistId` on patients and appointments (practitioner → `''`). **Does not** clear prescription dentist fields.

## LOCAL → CLOUD mapping

| Local | Cloud |
|---|---|
| id | UUID |
| firstName | firstName |
| lastName | lastName |
| specialty | specialty |
| photo | photo |
| color | color (normalized lowercase hex) |
| (computed) dentistName | `displayName` in API response |

## User link decision

**Not implemented.** Local Dentist has no User relation. Dentist ≠ User remains separate. Optional `Dentist.userId` deferred to a later phase.

## Opaque dentistId compatibility

Appointment / Patient / Prescription keep **opaque String** `dentistId` (no Prisma FK to Dentist).

Future migration may:

1. Import local dentists → Cloud UUIDs
2. Remap clinical opaque ids
3. Optionally add FKs

Not done in this phase.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/dentists` | `dentists.read` |
| GET | `/dentists/:id` | `dentists.read` |
| POST | `/dentists` | `dentists.create` |
| PATCH | `/dentists/:id` | `dentists.update` |
| DELETE | `/dentists/:id` | `dentists.delete` |

Query: `q` (name/specialty), `specialty`, `page`, `limit` (max 100).

## RBAC defaults

- ADMIN: all dentists.*
- ASSISTANT: `dentists.read` only

## Delete semantics (Cloud)

Hard delete in a transaction that also:

- nulls Patient.dentistId where matching (same org)
- nulls Appointment.dentistId + clears practitioner (same org)
- leaves Prescription.dentistId / dentistName unchanged

Matches local store behavior.

## Migration

**Not implemented.** No `dentisuite-store.json` import.

## Known limitations

- No User link
- No schedule/availability API
- No Dentist FK on clinical tables yet
- Photo stored as string (data URL); large payloads bounded by Zod max
- Electron remains LEGACY_LOCAL
