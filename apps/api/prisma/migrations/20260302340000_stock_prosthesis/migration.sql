-- Phase 5H: StockItem + Prosthesis (local clinic.stockItems / clinic.prostheses).
-- No stock movements. Prosthesis has Patient FK only (no Treatment/Dentist). Hard delete.

CREATE TABLE "StockItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "addedAt" DATE NOT NULL,
    "expiryDate" DATE,
    "supplier" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StockItem_organizationId_id_idx" ON "StockItem"("organizationId", "id");
CREATE INDEX "StockItem_organizationId_category_idx" ON "StockItem"("organizationId", "category");
CREATE INDEX "StockItem_organizationId_name_idx" ON "StockItem"("organizationId", "name");

ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Prosthesis" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tooth" TEXT NOT NULL,
    "lab" TEXT NOT NULL,
    "sentAt" DATE NOT NULL,
    "expectedAt" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prosthesis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Prosthesis_organizationId_patientId_idx" ON "Prosthesis"("organizationId", "patientId");
CREATE INDEX "Prosthesis_organizationId_status_idx" ON "Prosthesis"("organizationId", "status");
CREATE INDEX "Prosthesis_organizationId_id_idx" ON "Prosthesis"("organizationId", "id");

ALTER TABLE "Prosthesis" ADD CONSTRAINT "Prosthesis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Prosthesis" ADD CONSTRAINT "Prosthesis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
