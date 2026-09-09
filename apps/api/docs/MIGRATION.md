# Local → Cloud migration (Phase 6E)

Staging **APPLY** is implemented. Production **APPLY execution is disabled**. Phase 6E adds **pilot readiness** for one explicit cabinet copy (dry-run + policies + preflight). It does not migrate production.

See [PRODUCTION-MIGRATION-RUNBOOK.md](PRODUCTION-MIGRATION-RUNBOOK.md) and [PILOT-READINESS.md](PILOT-READINESS.md).

Staging **APPLY** is implemented and sign-off-tested against a **copy** of a real local store. **Production APPLY is not.** Electron remains `LEGACY_LOCAL`. License Manager is unchanged. `CLOUD_MODE` is not active.

Source must be an explicit **copy** (`--source` / `--media`). The live `%APPDATA%\dentisuite\dentisuite-store.json` is never read unless that path is supplied on purpose. Source JSON and media are never modified.

## Status (OrganizationMigration)

| Status | Meaning |
|---|---|
| `NOT_STARTED` | No process row / never applied |
| `DRY_RUN` | Dry-run recorded |
| `READY_FOR_APPROVAL` | Production dry-run clean (future persist; not auto-applied) |
| `APPROVED` | Operator approved a future production APPLY |
| `APPLYING` | APPLY writes in progress |
| `MIGRATED` | Writes finished; verification not yet passed |
| `VERIFYING` | Post-APPLY verification running |
| `VERIFIED` | Checks passed |
| `FAILED` | APPLY or verify failed; source untouched |
| `ABANDONED` | Staging rollback / operational abandon |

Dry-run never writes this row. `VERIFIED` is set only after verification succeeds.

## Commands

```bash
# Read-only
npm --prefix apps/api run migrate:dry-run -- --source <COPY.json> --media <COPY-media> --organization-id <uuid> [--out report.json]
npm --prefix apps/api run migrate:validate -- ...
npm --prefix apps/api run migrate:plan -- ...

# Staging APPLY (all four gates required)
MIGRATION_MODE=APPLY MIGRATION_CONFIRM=YES MIGRATION_ENV=STAGING TARGET_ORGANIZATION_ID=<uuid> \
  npm --prefix apps/api run migrate:apply -- \
  --source <COPY.json> --media <COPY-media> --organization-id <uuid> --out migration-apply-report.json

# Staging-only rollback (same gates). Not a public HTTP API.
MIGRATION_MODE=APPLY MIGRATION_CONFIRM=YES MIGRATION_ENV=STAGING \
  npm --prefix apps/api run migrate:rollback -- --organization-id <uuid>

# Post-APPLY verification (staging persists VERIFIED; production is read-only / no DATABASE_URL in this phase)
npm --prefix apps/api run migrate:verify -- --source <COPY.json> --media <COPY-media> --organization-id <uuid>

# Production preflight (gates + backup + dry-run; execution remains disabled)
npm --prefix apps/api run migrate:production-preflight -- \
  --source <backup-copy> --media <backup-media> --organization-id <uuid> \
  --backup-evidence <evidence.json> --out migration-production-report.json

# Pilot readiness (read-only; requires PILOT_* env + policy confirmations)
npm --prefix apps/api run migrate:pilot-readiness -- \
  --source <backup-copy> --media <backup-media> --organization-id <uuid> \
  --backup-evidence <evidence.json> --out pilot-readiness-report.json
```

Aliases: `SOURCE_JSON`, `SOURCE_MEDIA_ROOT`, `DENTISUITE_MIGRATION_*`.

`--non-strict` disables strict mode (default **strict = true**).

`targetOrganizationId` is **never** read from JSON. Organization / User / Membership are **never** created by APPLY.

## Safety gates

APPLY refuses unless:

- `MIGRATION_MODE=APPLY`
- `MIGRATION_CONFIRM=YES`
- `MIGRATION_ENV=STAGING`
- `TARGET_ORGANIZATION_ID` (or `--organization-id`)
- `NODE_ENV` is not `production`
- `R2_BUCKET` (if set) looks like staging/test/dev/local
- `DATABASE_URL` does not look like production
- Target organization **already exists** and name/slug contains `staging`, `test`, or `fixture`
- Organization is not already `MIGRATED` / `VERIFIED`

Refusal example: `Migration APPLY is allowed only in STAGING.`

## Mapping

UUID v5: `uuidV5(`${organizationId}:${entityType}:${localId}`)`  
Namespace: `a8e3c7b0-4f21-5d96-8c44-0b1d2e3f4a5b`

## Plan / write order

1. Dentist  
2. Patient  
3. Appointment  
4. ClinicalSession  
5. Treatment  
6. Prescription + PrescriptionItem  
7. Invoice  
8. StockItem  
9. Prosthesis  
10. PatientMedia metadata (`PENDING`)  
11. media objects → HEAD size check → `READY`

Writes go through the migration service + Prisma. Public `POST /patients` (etc.) is not used (snapshots would be overwritten).

## DB write strategy

Not one giant transaction (avoids long locks / huge memory).

Each entity family runs in its own `$transaction`. Before insert: `findFirst({ id, organizationId })`. Existing rows increment `alreadyExists` and are not duplicated.

Media bytes are uploaded **outside** the DB transaction. Metadata stays `PENDING` until the object exists and size matches.

## Media (staging storage only)

Disk: `{SOURCE_MEDIA_ROOT}/{localPatientId}/{filename}`  
Key: `org/{targetOrgId}/patients/{cloudPatientId}/media/{cloudMediaId}{ext}`

Missing / size-mismatch files: no `READY` metadata. DICOM is generic `PatientMedia` (not DICOMWeb/PACS).

## Policies (unchanged from 6A)

| Case | Policy |
|---|---|
| Walk-in prescription / invoice | SKIP |
| Prescription with zero lines | SKIP |
| Invoice amount ≤ 0 | SKIP |
| Empty patient phone | ERROR (strict) / SKIP (non-strict) |
| Missing dentist | `dentistId` null + WARNING |
| Missing treatment on invoice | `treatmentId` null + WARNING |
| Missing / size-mismatch media | SKIP (no READY) |
| Prosthesis `envoye` | preserved (no UI remap to `fabrication`) |
| `PatientSession.prescription` | free text on ClinicalSession only |
| ClinicSettings / ActCatalog | DEFERRED |
| zoomFactor | IGNORE |

## Rollback

`migrate:rollback` deletes **that staging organization’s** migrated clinical rows and storage objects, then sets status `ABANDONED`. It is CLI-only, staging-gated, and is not exposed on the public HTTP API. It does not touch production and does not delete Organization / User / Membership.

A second APPLY on a `VERIFIED` staging org is **idempotent** (alreadyExists, no duplicates). Use `migrate:rollback` to wipe clinical rows before a clean re-import.

## Phase 6C sign-off

Operator path: copy `dentisuite-store.json` + `media/` to an explicit staging folder (never mutate `%APPDATA%\dentisuite`). Then dry-run (0 errors), APPLY, verify, re-APPLY, rollback, re-APPLY.

Isolated staging uses PGlite (`dentisuite_test`) + memory object storage in tests. Production PostgreSQL and production buckets are gated out.

## Phase 6D

Production APPLY is **prepared and disabled**. Exact identity allowlists, backup evidence, production report (no secrets), `migrate:verify`, and the operator runbook exist. `PRODUCTION_APPLY_EXECUTION_ENABLED = false`.

## Phase 6E

Pilot readiness (`migrate:pilot-readiness`) classifies one operator-supplied copy. Verdict is `READY_FOR_PILOT_APPLY` or `NOT_READY`. Production APPLY stays disabled. Cutover steps 6–13 are not executed.

## Next phase

A first **pilot** production APPLY — only after `READY_FOR_PILOT_APPLY` on the chosen cabinet, real prod DB/R2 identities, and an explicit later enablement of execution. Not this phase.
