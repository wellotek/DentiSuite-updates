# Billing / Invoices Cloud API (Phase 5G)

## Local finance audit

### What exists

| Concept | Local reality |
|---|---|
| Invoice | `clinic.invoices` — finance “transaction” |
| Payment | **No entity** — `Invoice.paid: boolean` |
| Treatment paymentStatus | Separate field on Treatment (`paye`/`en_attente`/`partiel`) — not a Payment row |
| Line items / taxes | **None** |
| Invoice number | **None** — ids like `inv{timestamp}` / `i-{treatmentId}` |
| Currency | **DA** (Algerian dinars), UI rounds with `Math.round` |

### Exact `Invoice` fields

| Field | Type | Notes |
|---|---|---|
| id | string | |
| patientId? | string | walk-in allowed locally |
| patientName | string | denormalized |
| label | string | acte / libellé |
| amount | number | rounded to whole DA |
| paid | boolean | Payé vs Facturé |
| date | YYYY-MM-DD | |
| treatmentId? | string | optional link when synced from Treatment |

Hard delete. Patient delete filters invoices. Treatment delete removes linked invoices locally. Cloud Treatment API does **not** auto-sync invoices.

## LOCAL → CLOUD

| Local | Cloud |
|---|---|
| Invoice | Invoice |
| Payment | **not created** (`paid` boolean) |
| amount (number) | `Int` whole DA |
| patientId optional | **required** in Cloud |
| treatmentId | optional UUID FK (same org + same patient) |
| numbering | none (UUID only) |

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/invoices` | `billing.read` |
| GET | `/patients/:patientId/invoices` | `billing.read` |
| POST | `/patients/:patientId/invoices` | `billing.create` |
| GET | `/invoices/:id` | `billing.read` |
| PATCH | `/invoices/:id` | `billing.update` |
| DELETE | `/invoices/:id` | `billing.delete` |

Query: `date`, `from`, `to`, `paid`, `patientId`, `page`, `limit`.

## Permissions (Phase 4 defaults unchanged)

- **ADMIN**: all `billing.*`
- **ASSISTANT**: **no** billing permissions by default → all billing endpoints **403** unless overridden

## Money

- Unit: whole **DA**
- Storage: `Int`
- No multi-currency
- Reject non-integers / ≤ 0 / over max

## Delete

Hard delete invoice only. Treatment FK `ON DELETE SET NULL`. No Payment cascade.

## Migration

**Not implemented.**
