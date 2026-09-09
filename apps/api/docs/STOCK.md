# Stock Cloud API (Phase 5H)

## Local audit

`StockItem` in `clinic.stockItems` — **current quantity only**. No movement ledger.

| Field | Type | Notes |
|---|---|---|
| id | `st{timestamp}` | |
| code | string | uppercased in UI |
| name | string | |
| category | consommable \| prothese \| hygiene \| medicament | |
| quantity | number | integer, `Math.max(0, Math.round)` |
| minQuantity | number | integer |
| unitPrice | number | whole DA |
| addedAt | YYYY-MM-DD | |
| expiryDate | YYYY-MM-DD or `''` | optional |
| supplier | string | |

`adjustStockQuantity(id, delta)` exists locally; Cloud uses PATCH `quantity` (same net effect).

Hard delete. Not referenced by Invoice/Treatment.

## LOCAL → CLOUD

| Local | Cloud |
|---|---|
| StockItem | StockItem |
| expiryDate `''` | `expiryDate` null |
| unitPrice float-as-round | Int DA |

No warehouse / batch / serial / movements.

## Endpoints

| Method | Path | Permission |
|---|---|---|
| GET | `/stock` | `stock.read` |
| GET | `/stock/:id` | `stock.read` |
| POST | `/stock` | `stock.create` |
| PATCH | `/stock/:id` | `stock.update` |
| DELETE | `/stock/:id` | `stock.delete` |

Query: `q`, `category`, `page`, `limit`.

## Permissions (Phase 4 unchanged)

- ADMIN: all `stock.*`
- ASSISTANT: `stock.read` only

## Quantity / money

Freely editable integers. `unitPrice` whole DA (same as invoices). Value `quantity * unitPrice` is computed client-side locally — not stored.

## Delete

Hard delete. No cascade to clinical/financial rows.

## Migration

**Not implemented.**
