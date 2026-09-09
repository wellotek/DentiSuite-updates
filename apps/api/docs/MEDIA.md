# Patient Media / Documents Cloud API (Phase 5F)

## Local audit

### `PatientMedia` (`clinic.mediaFiles`)

| Field | Notes |
|---|---|
| id | `med{timestamp}{rand}` |
| patientId | required |
| title | string |
| kind | `image` \| `dicom` |
| mime | string |
| originalName | original upload name |
| filename | `{fileId}{ext}` on disk |
| dataUrl? | browser fallback |
| thumbnailUrl? | client-generated |
| createdAt | ISO string |
| size | bytes |

Path: `{userData}/media/{patientId}/{fileId}{ext}`  
Limit: **80 MB** (`MEDIA_MAX_BYTES` / electron)  
Extensions: `.jpg .jpeg .png .webp .gif .dcm .dicom`  
Hard delete metadata + file. Patient-scoped only (not org-wide docs).

### LOCAL → CLOUD

| Local | Cloud |
|---|---|
| PatientMedia | PatientMedia (metadata) |
| filename / path | `storageKey` (server-generated) |
| bytes on disk | Cloudflare R2 object |
| dataUrl / thumbnailUrl | deferred |
| kind image\|dicom | same (file storage only; **no DICOMWeb**) |

## Provider

**Cloudflare R2** (S3-compatible) for production (`OBJECT_STORAGE_PROVIDER=r2`).  
**MemoryObjectStorage** for tests/dev without credentials (default).

## Storage key

```
org/{organizationId}/patients/{patientId}/media/{mediaId}{ext}
```

Server-only. Client cannot inject `storageKey` / `organizationId` / bucket.

## Flows

1. `POST /patients/:patientId/media` → PENDING + signed PUT URL  
2. Client uploads to object storage  
3. `POST /media/:id/complete` → HEAD object; size must match; → READY or FAILED  
4. `GET /media/:id/url` → short-lived signed GET (READY only)  
5. `DELETE /media/:id` → metadata + object (hard delete)

## Permissions

`documents.read` · `documents.upload` · `documents.delete`  
(ASSISTANT: read + upload; no delete by default)

## AV scanning

Not implemented. Extension point: verify after HEAD / before READY.

## Deferred

Media migration, Electron cloud wiring, DICOMWeb/PACS, thumbnails in DB.
