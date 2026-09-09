-- Phase 3: Organization, Membership, LicenseBinding.
-- No RBAC permission tables. No clinical tables.

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "MembershipRole" AS ENUM ('ADMIN', 'ASSISTANT');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "LicenseBindingStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED', 'PENDING');

CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseBinding" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "licenseId" TEXT NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "status" "LicenseBindingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LicenseBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE INDEX "Organization_status_idx" ON "Organization"("status");

CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE INDEX "Membership_status_idx" ON "Membership"("status");
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

CREATE UNIQUE INDEX "LicenseBinding_organizationId_key" ON "LicenseBinding"("organizationId");
CREATE UNIQUE INDEX "LicenseBinding_licenseId_key" ON "LicenseBinding"("licenseId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseBinding" ADD CONSTRAINT "LicenseBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
