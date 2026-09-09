-- Phase 4: Permission, RolePermission, MembershipPermissionOverride.
-- No clinical tables.

CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "permissionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MembershipPermissionOverride" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");
CREATE UNIQUE INDEX "RolePermission_role_permissionId_key" ON "RolePermission"("role", "permissionId");

CREATE INDEX "MembershipPermissionOverride_membershipId_idx" ON "MembershipPermissionOverride"("membershipId");
CREATE INDEX "MembershipPermissionOverride_permissionId_idx" ON "MembershipPermissionOverride"("permissionId");
CREATE UNIQUE INDEX "MembershipPermissionOverride_membershipId_permissionId_key" ON "MembershipPermissionOverride"("membershipId", "permissionId");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipPermissionOverride" ADD CONSTRAINT "MembershipPermissionOverride_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MembershipPermissionOverride" ADD CONSTRAINT "MembershipPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
