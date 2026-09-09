# Pilot production migration readiness (Phase 6E)

**Readiness only.** Production APPLY stays disabled. This command does not write the production database, production object storage, or the local source copy. Electron stays `LEGACY_LOCAL`. License Manager is not called.

## Identity (required)

Never inferred. Never taken from source JSON.

```bash
PILOT_SOURCE_JSON=<backup-copy/dentisuite-store.json>
PILOT_MEDIA_ROOT=<backup-copy/media>
PILOT_TARGET_ORGANIZATION_ID=<organization-uuid>
PILOT_BACKUP_EVIDENCE=<path/to/migration-backup-evidence.json>
PILOT_EXPECTED_ORGANIZATION_SLUG=<optional-slug-check>
```

Live `%APPDATA%\dentisuite\dentisuite-store.json` is refused.

## Policy confirmation (required — no silent defaults)

```bash
PILOT_POLICY_WALK_IN_INVOICE=SKIP
PILOT_POLICY_WALK_IN_PRESCRIPTION=SKIP
PILOT_POLICY_EMPTY_PHONE=ERROR
PILOT_POLICY_SETTINGS=DEFERRED
PILOT_POLICY_ACT_CATALOG=DEFERRED
```

Any other value, or a missing variable, yields `NOT_READY`.

## Command

Also set the Phase 6D production identity allowlists (opaque labels, not URLs).

```bash
npm --prefix apps/api run migrate:pilot-readiness -- \
  --source <same as PILOT_SOURCE_JSON> \
  --media <same as PILOT_MEDIA_ROOT> \
  --organization-id <same as PILOT_TARGET_ORGANIZATION_ID> \
  --backup-evidence <evidence.json> \
  --out pilot-readiness-report.json
```

Exit 0 only when the verdict is `READY_FOR_PILOT_APPLY`.

## Verdict

`READY_FOR_PILOT_APPLY` only when backup hashes match, dry-run has 0 errors, all five policies are confirmed, dentist references map, media size mismatches are absent, the target organization exists and is ACTIVE and not already migrated, and production preflight passes. Otherwise `NOT_READY`.

Walk-in invoices/prescriptions are **classified, not migrated**. Empty phones are not invented. Settings and ActCatalog are not migrated.

## Cutover checklist (do not execute 6–13 in this phase)

1. Stop/close local DentiSuite  
2. Create final backup  
3. Verify backup hash  
4. Run final dry-run  
5. Review report  
6. Approve  
7. Run future APPLY  
8. Verify counts  
9. Verify relations  
10. Verify content  
11. Verify media  
12. Keep local backup  
13. Only after verification consider Cloud cutover  

## Rollback

Local source stays authoritative until a later cutover. Migration does not delete local JSON/media. There is no production delete-organization-data command. Isolate the Cloud organization if a future APPLY ever writes rows.
