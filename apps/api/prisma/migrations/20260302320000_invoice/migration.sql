-- Phase 5G: Invoice (local clinic.invoices finance transactions).
-- No Payment table. Amount = whole DA. Optional treatmentId (ON DELETE SET NULL).

CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "patientName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "date" DATE NOT NULL,
    "treatmentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Invoice_organizationId_patientId_idx" ON "Invoice"("organizationId", "patientId");
CREATE INDEX "Invoice_organizationId_date_idx" ON "Invoice"("organizationId", "date");
CREATE INDEX "Invoice_organizationId_paid_idx" ON "Invoice"("organizationId", "paid");
CREATE INDEX "Invoice_organizationId_id_idx" ON "Invoice"("organizationId", "id");
CREATE INDEX "Invoice_organizationId_treatmentId_idx" ON "Invoice"("organizationId", "treatmentId");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
