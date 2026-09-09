# DentiSuite API (Phase 6E — pilot readiness; production APPLY disabled)

Isolated backend. Electron / LEGACY_LOCAL / License Manager unchanged. Production APPLY is prepared and disabled.

## Clinical tables

Patient · Appointment · ClinicalSession · Treatment · Prescription · Dentist · PatientMedia · Invoice · StockItem · Prosthesis

Process (not clinical): **OrganizationMigration** (dry-run never writes it; staging APPLY does).

## Docs

- [AUTH.md](docs/AUTH.md)
- [ORGANIZATION.md](docs/ORGANIZATION.md)
- [RBAC.md](docs/RBAC.md)
- [PATIENTS.md](docs/PATIENTS.md)
- [APPOINTMENTS.md](docs/APPOINTMENTS.md)
- [CONSULTATIONS.md](docs/CONSULTATIONS.md)
- [PRESCRIPTIONS.md](docs/PRESCRIPTIONS.md)
- [DENTISTS.md](docs/DENTISTS.md)
- [MEDIA.md](docs/MEDIA.md)
- [BILLING.md](docs/BILLING.md)
- [STOCK.md](docs/STOCK.md)
- [PROSTHESES.md](docs/PROSTHESES.md)
- [MIGRATION.md](docs/MIGRATION.md)
- [PRODUCTION-MIGRATION-RUNBOOK.md](docs/PRODUCTION-MIGRATION-RUNBOOK.md)
- [PILOT-READINESS.md](docs/PILOT-READINESS.md)

## Commands

```bash
npm --prefix apps/api run prisma:generate
npm --prefix apps/api run prisma:migrate:dev
npm --prefix apps/api run test
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/api run migrate:dry-run -- --source <COPY.json> --media <COPY-media> --organization-id <uuid>
```

`migrate:apply` / `migrate:rollback` require `MIGRATION_MODE=APPLY`, `MIGRATION_CONFIRM=YES`, `MIGRATION_ENV=STAGING`, and an existing staging organization. They never target production.

## Out of scope

Production JSON APPLY execution, DICOMWeb, Electron cloud mode, License Manager HTTP.
