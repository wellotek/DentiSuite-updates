# Prostheses Cloud API (Phase 5H)

## Local audit

`Prosthesis` in `clinic.prostheses` — lab order tracking.

| Field | Type |
|---|---|
| id | `pr{timestamp}` |
| type | string (catalog + custom) |
| tooth | string (site / range) |
| patientId | required |
| patientName | denormalized |
| lab | free-text lab name |
| sentAt | YYYY-MM-DD |
| expectedAt? | YYYY-MM-DD |
| notes? | string |
| status | envoye \| fabrication \| recu \| pose \| annulee |

No Treatment / Dentist / Appointment FK. No lab directory table. No cost on the prosthesis row.

UI maps `envoye` → `fabrication` for display only; Cloud stores the real status.

Hard delete. Patient delete cascades local prostheses; Cloud FK `onDelete: Cascade` on Patient.

## LOCAL → CLOUD

| Local | Cloud |
|---|---|
| Prosthesis | Prosthesis |
| patientName | snapshot from Patient |
| lab | opaque string |
| expectedAt missing | null |

## Permissions

No `prostheses.*` in Phase 4 vocabulary. Prostheses are patient-scoped lab jobs, so they use:

`patients.read` · `patients.create` · `patients.update` · `patients.delete`

ASSISTANT: read/create/update; **no** delete (unchanged defaults).

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/prostheses` | `patients.read` |
| GET | `/patients/:patientId/prostheses` | `patients.read` |
| POST | `/patients/:patientId/prostheses` | `patients.create` |
| GET | `/prostheses/:id` | `patients.read` |
| PATCH | `/prostheses/:id` | `patients.update` |
| DELETE | `/prostheses/:id` | `patients.delete` |

Query: `q`, `status`, `patientId`, `page`, `limit`.

## Relations

Patient `{ id, organizationId }` required. Cross-tenant patient → 404. No dentist/treatment checks (no local FKs).

## Migration

**Not implemented.**
