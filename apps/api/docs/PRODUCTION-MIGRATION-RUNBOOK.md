# Production migration runbook (Phase 6D)

**Production APPLY execution is disabled.** This document prepares a future controlled pilot. It does not migrate a customer cabinet.

Electron stays `LEGACY_LOCAL`. Do not enable `CLOUD_MODE`. Do not call License Manager HTTP. Do not modify live `%APPDATA%\dentisuite` unless an operator **explicitly** points `--source` at a **copy**.

## Flow

PREPARE → BACKUP → DRY RUN → REVIEW → APPROVE → APPLY *(future)* → VERIFY → KEEP LOCAL BACKUP → CUTOVER LATER *(not this phase)*

## PREPARE

1. Create or select a single **existing** Cloud Organization (never created by the migrator).
2. Record its UUID. It is never read from `dentisuite-store.json`.
3. Configure opaque identities (not connection strings):

```bash
MIGRATION_DATABASE_IDENTITY=<opaque-prod-db-label>
MIGRATION_ALLOWED_DATABASE_IDENTITY=<same-label>
MIGRATION_STORAGE_IDENTITY=r2:<exact-bucket-label>
MIGRATION_ALLOWED_STORAGE_IDENTITY=r2:<exact-bucket-label>
MIGRATION_STORAGE_PROVIDER=r2
MIGRATION_ALLOWED_STORAGE_PROVIDER=r2
MIGRATION_ALLOWED_ORGANIZATION_ID=<organization-uuid>
TARGET_ORGANIZATION_ID=<organization-uuid>
```

Optional exact region/account identities (when the provider exposes them):

```bash
MIGRATION_STORAGE_REGION=<region-label>
MIGRATION_ALLOWED_STORAGE_REGION=<same-label>
MIGRATION_STORAGE_ACCOUNT_IDENTITY=<opaque-account-label>
MIGRATION_ALLOWED_STORAGE_ACCOUNT_IDENTITY=<same-label>
```

Expected object prefix: `org/{organizationId}/patients/{patientId}/media/`

Memory / test / development storage providers are refused.

## BACKUP

Operator-supplied backup is required (this phase does not automate cloud backup).

Copy the local store and media to a backup directory. Write `migration-backup-evidence.json`:

```json
{
  "sourceJsonBackupPath": "/path/to/backup/dentisuite-store.json",
  "sourceMediaBackupPath": "/path/to/backup/media",
  "backupTimestamp": "2026-09-03T00:00:00.000Z",
  "jsonSha256": "<sha256 of the JSON copy>",
  "mediaManifestHash": "<relative media manifest sha256>",
  "mediaFileCount": 0
}
```

APPLY refuses if this file is missing or hashes do not match `--source` / `--media`.

## DRY RUN

```bash
npm --prefix apps/api run migrate:dry-run -- \
  --source <backup-copy/dentisuite-store.json> \
  --media <backup-copy/media> \
  --organization-id <organization-uuid> \
  --out dry-run-report.json
```

Required: **0 blocking errors**. Classify every warning and skip (walk-in invoices/prescriptions, empty phone, money, missing dentist, missing media, deferred settings/catalog).

## REVIEW

Unresolved product decisions (do not silently change policy):

1. Walk-in invoice → currently SKIP
2. Walk-in prescription → currently SKIP
3. Empty phone → currently strict ERROR
4. ClinicSettings → currently DEFERRED (`--copy-organization-name` optional, default off)
5. ActCatalog → currently DEFERRED (`Treatment.act` / `code` / `actId` preserved opaque)

Prosthesis `envoye` stays `envoye`. `PatientSession.prescription` stays ClinicalSession free text.

## APPROVE

All of these must be set (no defaults):

```bash
MIGRATION_MODE=APPLY
MIGRATION_CONFIRM=YES
MIGRATION_PRODUCTION_APPROVAL=YES
MIGRATION_ENV=PRODUCTION
TARGET_ORGANIZATION_ID=<organization-uuid>
```

## APPLY (documented; execution disabled in Phase 6D)

```bash
MIGRATION_MODE=APPLY
MIGRATION_CONFIRM=YES
MIGRATION_PRODUCTION_APPROVAL=YES
MIGRATION_ENV=PRODUCTION
TARGET_ORGANIZATION_ID=<organization-uuid>
MIGRATION_BACKUP_EVIDENCE=<path/to/migration-backup-evidence.json>

npm --prefix apps/api run migrate:apply -- \
  --source <backup-copy/dentisuite-store.json> \
  --media <backup-copy/media> \
  --organization-id <organization-uuid> \
  --backup-evidence <path/to/migration-backup-evidence.json> \
  --out migration-production-report.json
```

Today this command **preflights then refuses to write**. It will not insert patients, upload media, or mark VERIFIED. It does not open a production `DATABASE_URL` unless an isolated Prisma client is injected (tests only).

`PRODUCTION_APPLY_EXECUTION_ENABLED` is hardcoded `false`.

## VERIFY (after a future successful APPLY)

```bash
npm --prefix apps/api run migrate:verify -- \
  --source <backup-copy/dentisuite-store.json> \
  --media <backup-copy/media> \
  --organization-id <organization-uuid>
```

Requires migration state `MIGRATED`, `VERIFYING`, or `VERIFIED`. Checks count, reference, content, media, snapshot, enum, and money parity. VERIFIED is only set when verification passes (staging persist). Production verify is read-only in this phase.

## KEEP LOCAL BACKUP

Retain the JSON copy, media copy, evidence file, dry-run report, and production report. Source hashes in the report must remain unchanged.

## CUTOVER LATER (not implemented)

`LEGACY_LOCAL` → migration verified → operator approval → future `CLOUD_MODE`.

Never switch Electron during migration.

## Rollback (production)

**No production delete-organization-data command.** Rollback is an operational decision:

1. Do not enable Cloud Mode / do not cut over the desktop.
2. Preserve the local JSON + media backups.
3. Optionally set Organization status to DISABLED so the cabinet is not used in Cloud.
4. Restore from the operator backup if Cloud rows were ever written in a future phase.
5. Staging-only `migrate:rollback` remains STAGING-gated and is not for production.

## License

Do not call `https://license.dentisuite.xyz`. Existing `LicenseBinding` rows are not modified. Set `MIGRATION_REQUIRE_LICENSE_BINDING=YES` only if an ACTIVE binding must already exist.

## Report

`migration-production-report.json` uses opaque identities. It must never contain passwords, tokens, `DATABASE_URL`, or storage secrets.

## Pilot readiness (Phase 6E)

Classify one explicit cabinet copy. Does not APPLY.

See [PILOT-READINESS.md](PILOT-READINESS.md).

```bash
PILOT_SOURCE_JSON=<backup-copy/dentisuite-store.json>
PILOT_MEDIA_ROOT=<backup-copy/media>
PILOT_TARGET_ORGANIZATION_ID=<organization-uuid>
PILOT_POLICY_WALK_IN_INVOICE=SKIP
PILOT_POLICY_WALK_IN_PRESCRIPTION=SKIP
PILOT_POLICY_EMPTY_PHONE=ERROR
PILOT_POLICY_SETTINGS=DEFERRED
PILOT_POLICY_ACT_CATALOG=DEFERRED

npm --prefix apps/api run migrate:pilot-readiness -- \
  --source <backup-copy/dentisuite-store.json> \
  --media <backup-copy/media> \
  --organization-id <organization-uuid> \
  --backup-evidence <evidence.json> \
  --out pilot-readiness-report.json
```

Verdict `READY_FOR_PILOT_APPLY` or `NOT_READY`. Production APPLY remains disabled. Do not execute cutover steps 6–13.
