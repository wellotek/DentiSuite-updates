# Consultations / Treatments Cloud API (Phase 5C)

## Local model audit

| Concept | Local reality |
|---|---|
| Consultation | **UI / appointment category only** — no `Consultation` entity |
| Session / séance | `PatientSession` in `clinic.sessions` |
| Treatment | `Treatment` in `clinic.treatments` |
| Relationship | **Siblings under Patient**, not parent/child |

### Local `PatientSession` (séance)

Fields: `id`, `patientId`, `date`, `time`, `teeth: string[]`, `acts`, `notes`, `prescription` (free text — **not** Prescriptions domain).  
IDs like `ses{timestamp}`. **Hard delete.** No dentist FK on session.

### Local `Treatment`

Fields: `id`, `patientId`, `date`, `tooth`, `act`, `code`, `cost`, `comment`, `careStatus` (`a_faire` \| `fait`), `paymentStatus` (`paye` \| `en_attente` \| `partiel`), optional `actId`.  
IDs like `t{timestamp}`. **Hard delete.** Local store also syncs odontogram + invoices — **not** replicated in this Cloud phase.

## LOCAL → CLOUD mapping

| Local | Cloud Prisma | Public API name |
|---|---|---|
| `PatientSession` | `ClinicalSession` | Consultation (`/consultations`) |
| `Treatment` | `Treatment` | Treatment (`/treatments`) |

API uses `/consultations` to match existing RBAC `consultations.*`.  
Prisma uses `ClinicalSession` so it is not confused with auth `Session`.

**Not implemented as nested:** `/consultations/:id/treatments` — would invent a parent/child link that does not exist locally.

## Cloud models

Both require non-null `organizationId` + `patientId` (same-org Patient).

- **ClinicalSession:** date (DATE), time (HH:mm), teeth (JSON string[]), acts, notes, prescription (string)
- **Treatment:** date, tooth, act, code, cost, comment, careStatus, paymentStatus, actId?

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/patients/:patientId/consultations` | `consultations.read` |
| POST | `/patients/:patientId/consultations` | `consultations.create` |
| GET | `/consultations/:id` | `consultations.read` |
| PATCH | `/consultations/:id` | `consultations.update` |
| DELETE | `/consultations/:id` | `consultations.delete` |
| GET | `/patients/:patientId/treatments` | `consultations.read` |
| POST | `/patients/:patientId/treatments` | `consultations.create` |
| GET | `/treatments/:id` | `consultations.read` |
| PATCH | `/treatments/:id` | `consultations.update` |
| DELETE | `/treatments/:id` | `consultations.delete` |

No separate `treatments.*` permissions — same clinical chart boundary.

### Query filters

- Consultations: `date`, `page`, `limit` (max 100)
- Treatments: `date`, `careStatus`, `paymentStatus`, `page`, `limit`

## Tenant / relation safety

- `organizationId` always from membership context (client cannot override)
- Route `patientId` verified with `{ id, organizationId }` → else **404**
- Cross-tenant clinical id → **404**
- PATCH `patientId` to foreign-org patient → **404**
- Patient-scoped lists never leak other tenants

## Pipeline

authenticate → tenant → `requirePermission(consultations.*)` → Zod validate → tenant-safe Patient lookup → mutation → response

## Tooth / odontogram strategy

- Session: preserve `teeth: string[]` as JSON (visit tooth refs)
- Treatment: single `tooth` string
- Patient odontogram (`Patient.teeth` map) unchanged; no Cloud odontogram sync on treatment create

## Dentist / practitioner

No dentist field on local PatientSession/Treatment in the audited model. No Dentist cloud table. Opaque `dentistId` remains only on Patient/Appointment from prior phases.

## Deletion semantics

- ClinicalSession / Treatment: **hard delete** (matches local)
- Deleting a Patient cascades ClinicalSession + Treatment via FK (org-scoped)
- No Invoice side-effects in this phase

## Transactions

Used for list `count` + `findMany` consistency. No multi-entity create (siblings, not nested). Patient delete cascade is DB-level.

## Known limitations

- No JSON migration from `dentisuite-store.json`
- No Electron / CLOUD_MODE wiring
- No Prescriptions / Billing / Imaging / Stock APIs
- No Dentist directory
- Treatment cost/payment fields stored; billing engine not implemented
- `prescription` on ClinicalSession is free text only
