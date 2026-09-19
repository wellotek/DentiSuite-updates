-- Patient birthDate + prescription identity/medication snapshots
ALTER TABLE "Patient" ADD COLUMN "birthDate" TEXT;

ALTER TABLE "Prescription" ADD COLUMN "patientBirthDate" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "patientAge" INTEGER;

ALTER TABLE "PrescriptionItem" ADD COLUMN "medicationId" TEXT;
ALTER TABLE "PrescriptionItem" ADD COLUMN "dci" TEXT;
ALTER TABLE "PrescriptionItem" ADD COLUMN "form" TEXT;
ALTER TABLE "PrescriptionItem" ADD COLUMN "dosage" TEXT;
ALTER TABLE "PrescriptionItem" ADD COLUMN "quantity" TEXT;
