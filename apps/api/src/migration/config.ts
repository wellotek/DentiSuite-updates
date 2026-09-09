import { z } from 'zod';

const uuidSchema = z.string().uuid('targetOrganizationId must be a UUID');

const skipPolicySchema = z.enum(['skip']);

export const migrationConfigSchema = z
  .object({
    sourceJsonPath: z.string().min(1),
    sourceMediaRoot: z.string().min(1),
    /** Trusted config only — never read from dentisuite-store.json. */
    targetOrganizationId: uuidSchema,
    dryRun: z.boolean().default(true),
    strict: z.boolean().default(true),
    /** Default false: do not copy ClinicSettings.name onto Organization.name. */
    copyOrganizationName: z.boolean().default(false),
    /** Report JSON path. Optional; dry-run never writes the source JSON. */
    reportPath: z.string().min(1).optional(),
    policies: z
      .object({
        walkInPrescription: skipPolicySchema.default('skip'),
        walkInInvoice: skipPolicySchema.default('skip'),
        zeroAmountInvoice: skipPolicySchema.default('skip'),
        prescriptionNoLines: skipPolicySchema.default('skip'),
        missingMedia: skipPolicySchema.default('skip'),
      })
      .default({}),
  })
  .strict()
  .transform((data) => ({
    sourceJsonPath: data.sourceJsonPath,
    sourceMediaRoot: data.sourceMediaRoot,
    targetOrganizationId: data.targetOrganizationId,
    dryRun: data.dryRun,
    strict: data.strict,
    copyOrganizationName: data.copyOrganizationName,
    reportPath: data.reportPath,
    policies: {
      walkInPrescription: data.policies.walkInPrescription,
      walkInInvoice: data.policies.walkInInvoice,
      zeroAmountInvoice: data.policies.zeroAmountInvoice,
      prescriptionNoLines: data.policies.prescriptionNoLines,
      missingMedia: data.policies.missingMedia,
    },
  }));

export type MigrationConfig = z.infer<typeof migrationConfigSchema>;

export function parseMigrationConfig(input: unknown): MigrationConfig {
  return migrationConfigSchema.parse(input);
}
