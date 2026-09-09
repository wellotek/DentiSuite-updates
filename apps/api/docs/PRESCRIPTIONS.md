# Prescriptions Cloud API (Phase 5D)

## Local audit

### A. `clinic.prescriptions`

Structured ordonnances (`Prescription` in `src/types.ts`):

| Field | Type | Notes |
|---|---|---|
| id | `rx{timestamp}` | hard delete |
| patientId? | string | optional (walk-in) |
| patientName | string | required denormalized |
| date | `YYYY-MM-DD` | civil date |
| title | string | |
| templateId? | string | client template catalog |
| lines | `PrescriptionLine[]` | structured items |
| advice | string | |
| dentistId? | string | opaque |
| dentistName | string | denormalized |

`PrescriptionLine`: `id`, `drug`, `posology`, `duration`, `notes`.

No `sessionId`. No status. No Treatment link. Store replaces whole document on update. Print via `prescriptionReport.ts`.

### B. `PatientSession.prescription`

Free-text notes on a séance (`ClinicalSession.prescription` in Cloud). Unrelated to `clinic.prescriptions`.

### C–M answers

| Question | Answer |
|---|---|
| Related to session free-text? | **No** |
| Structured? | **Yes** |
| Line items? | **Yes** (`lines`) |
| Medication catalog FK? | **No** (drug is free text; templates are client-only) |
| Dosage/frequency/duration? | posology + duration (+ notes) |
| Status? | **No** |
| Dentist? | dentistId opaque + dentistName |
| Own date? | **Yes** |
| patientId? | Optional locally; **required in Cloud** |
| sessionId? | **No** |
| ID format | `rx{timestamp}` locally → UUID in Cloud |

## LOCAL → CLOUD mapping

| Local | Cloud |
|---|---|
| `Prescription` | `Prescription` |
| `PrescriptionLine` | `PrescriptionItem` |
| `PatientSession.prescription` | unchanged on `ClinicalSession` (not migrated / not merged) |

Walk-in prescriptions without `patientId` are **not** supported in Cloud (route requires Patient). Documented limitation.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/patients/:patientId/prescriptions` | `prescriptions.read` |
| POST | `/patients/:patientId/prescriptions` | `prescriptions.create` |
| GET | `/prescriptions/:id` | `prescriptions.read` |
| PATCH | `/prescriptions/:id` | `prescriptions.update` |
| DELETE | `/prescriptions/:id` | `prescriptions.delete` |

Lines are embedded in create/update payloads (matches local whole-document save). **No** separate `/prescription-items` APIs.

Query: `date`, `q` (title / patientName / drug), `page`, `limit` (max 100).

## Tenant safety

- `organizationId` from membership only
- Patient lookup `{ id, organizationId }` before create/list
- Cross-tenant prescription id → **404**
- PATCH `patientId` to foreign patient → **404**
- Items always same `organizationId` as parent (transactional replace)

## Dentist strategy

Opaque `dentistId` + client `dentistName`. No Dentist FK.

## Deletion

**Hard delete** (matches local). Cascades `PrescriptionItem`. Patient delete cascades prescriptions.

## Transactions

Create / update-with-lines use Prisma transactions (header + replace lines).

## Migration

**Not implemented.** No `dentisuite-store.json` import. Session free-text not migrated.

## Known limitations

- Cloud requires `patientId` (no walk-in)
- No print/PDF API
- No template catalog table
- No Dentist / session / treatment links
- Electron still LEGACY_LOCAL
