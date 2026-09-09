import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { createObjectStorageFromConfig, loadConfig } from '../config/env.js';
import { createPrismaClient } from '../lib/prisma.js';
import type { ObjectStorage } from '../media/storage.js';
import { parseMigrationConfig } from './config.js';
import { ApplyGateError, assertApplyGates, gatesFromEnv } from './apply-gate.js';
import { runDryRun } from './dry-run.js';
import {
  formatApplyReport,
  formatHumanReport,
  writeApplyReportJson,
  writeProductionReportJson,
  writeReportJson,
} from './report.js';
import { MIGRATION_PLAN_ORDER } from './planner.js';
import { runApply, type ApplyDeps } from './apply.js';
import { rollbackStagingMigration } from './rollback.js';
import {
  PRODUCTION_APPLY_EXECUTION_ENABLED,
  assertProductionGates,
  productionGatesFromEnv,
} from './production-gate.js';
import { allowlistsFromEnv, assertProductionAllowlists } from './allowlist.js';
import { runMigrationVerify } from './verify-command.js';
import { formatPilotReadiness, runPilotReadiness } from './pilot-readiness.js';
import { refuseProductionApplyExecution, runProductionPreflight } from './production-preflight.js';

function flag(args: string[], name: string): boolean {
  return args.includes(name);
}

function opt(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
}

function configFromArgs(args: string[], env: NodeJS.ProcessEnv) {
  const sourceJsonPath = opt(args, '--source') ?? env.DENTISUITE_MIGRATION_SOURCE ?? env.SOURCE_JSON;
  const sourceMediaRoot = opt(args, '--media') ?? env.DENTISUITE_MIGRATION_MEDIA ?? env.SOURCE_MEDIA_ROOT;
  const targetOrganizationId =
    opt(args, '--organization-id') ??
    env.TARGET_ORGANIZATION_ID ??
    env.DENTISUITE_MIGRATION_ORGANIZATION_ID;
  if (!sourceJsonPath || !sourceMediaRoot || !targetOrganizationId) {
    throw new Error(
      'Required: --source <COPY of dentisuite-store.json> --media <COPY of media-root> --organization-id <uuid>',
    );
  }
  return parseMigrationConfig({
    sourceJsonPath,
    sourceMediaRoot,
    targetOrganizationId,
    dryRun: true,
    strict: !flag(args, '--non-strict'),
    copyOrganizationName: flag(args, '--copy-organization-name'),
    reportPath: opt(args, '--out'),
  });
}

export type MigrationCliDeps = {
  prisma?: PrismaClient;
  storage?: ObjectStorage;
};

function stagingClients(
  env: NodeJS.ProcessEnv,
  deps?: MigrationCliDeps,
): { prisma: PrismaClient; storage: ObjectStorage } {
  if (deps?.prisma && deps?.storage) {
    return { prisma: deps.prisma, storage: deps.storage };
  }
  const appConfig = loadConfig(env);
  if (appConfig.isProduction) {
    throw new ApplyGateError('Migration APPLY is allowed only in STAGING.');
  }
  return {
    prisma: createPrismaClient(),
    storage: createObjectStorageFromConfig(appConfig),
  };
}

function readClients(
  env: NodeJS.ProcessEnv,
  deps?: MigrationCliDeps,
): { prisma: PrismaClient; storage: ObjectStorage } {
  if (deps?.prisma && deps?.storage) {
    return { prisma: deps.prisma, storage: deps.storage };
  }
  const appConfig = loadConfig(env);
  return {
    prisma: createPrismaClient(),
    storage: createObjectStorageFromConfig(appConfig),
  };
}

export async function runMigrationCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  deps?: MigrationCliDeps,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const [command, ...args] = argv;
  try {
    if (command === 'rollback' && env.MIGRATION_ENV === 'PRODUCTION') {
      throw new ApplyGateError(
        'Production rollback is an operational decision. No production delete-organization-data command exists.',
      );
    }
    if ((command === 'apply' || command === 'rollback') && env.MIGRATION_ENV !== 'PRODUCTION') {
      assertApplyGates(gatesFromEnv(env));
    }
    if (command === 'rollback') {
      const organizationId =
        opt(args, '--organization-id') ??
        env.TARGET_ORGANIZATION_ID ??
        env.DENTISUITE_MIGRATION_ORGANIZATION_ID;
      if (!organizationId) {
        throw new Error('rollback requires --organization-id <uuid>');
      }
      const clients = stagingClients(env, deps);
      const result = await rollbackStagingMigration({
        prisma: clients.prisma,
        storage: clients.storage,
        organizationId,
        gates: gatesFromEnv(env),
      });
      return {
        exitCode: 0,
        stdout: `Staging rollback complete\n${JSON.stringify(result.deleted)}\n`,
        stderr: '',
      };
    }
    if (command === 'apply' && env.MIGRATION_ENV === 'PRODUCTION') {
      const config = configFromArgs(args, env);
      assertProductionGates({
        ...productionGatesFromEnv(env),
        targetOrganizationId: config.targetOrganizationId,
      });
      assertProductionAllowlists({
        ...allowlistsFromEnv(env),
        targetOrganizationId: config.targetOrganizationId,
      });
      const backupEvidencePath =
        opt(args, '--backup-evidence') ?? env.MIGRATION_BACKUP_EVIDENCE;
      if (!backupEvidencePath) {
        throw new ApplyGateError('Production APPLY refuses: backup evidence is absent.');
      }
      if (!PRODUCTION_APPLY_EXECUTION_ENABLED) {
        const preflightReport = await runProductionPreflight(config, {
          prisma: deps?.prisma,
          env,
          backupEvidencePath,
        });
        const preflightOut = config.reportPath ?? 'migration-production-report.json';
        writeProductionReportJson(preflightOut, preflightReport);
        refuseProductionApplyExecution();
      }
      // Phase 6F.3: controlled production pilot APPLY after preflight.
      if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
        process.env.DIRECT_URL = process.env.DATABASE_URL;
      }
      const appConfig = loadConfig(env);
      if (appConfig.objectStorageProvider !== 'r2') {
        throw new ApplyGateError('Production APPLY requires OBJECT_STORAGE_PROVIDER=r2.');
      }
      const prisma = deps?.prisma ?? createPrismaClient();
      const storage = deps?.storage ?? createObjectStorageFromConfig(appConfig);
      const preflightReport = await runProductionPreflight(config, {
        prisma,
        env,
        backupEvidencePath,
      });
      const preflightOut = config.reportPath ?? 'migration-production-report.json';
      writeProductionReportJson(preflightOut, preflightReport);
      const applyDeps: ApplyDeps = {
        prisma,
        storage,
        gates: gatesFromEnv(env),
        mode: 'PRODUCTION',
      };
      const { report } = await runApply({ ...config, dryRun: false }, applyDeps);
      const applyOut =
        opt(args, '--apply-out') ??
        (config.reportPath
          ? config.reportPath.replace(/\.json$/i, '-apply.json')
          : 'migration-apply-report.json');
      writeApplyReportJson(applyOut, report);
      const human = formatApplyReport(report);
      return {
        exitCode: report.ok ? 0 : 1,
        stdout: `${human}\npreflight: ${preflightOut}\nreport: ${applyOut}\nexecutionEnabled=true\n`,
        stderr: report.ok ? '' : `${report.errors.join('\n')}\n`,
      };
    }
    if (command === 'apply') {
      const config = configFromArgs(args, env);
      const clients = stagingClients(env, deps);
      const applyDeps: ApplyDeps = {
        prisma: clients.prisma,
        storage: clients.storage,
        gates: gatesFromEnv(env),
        mode: 'STAGING',
      };
      const { report } = await runApply({ ...config, dryRun: true }, applyDeps);
      const outPath = config.reportPath ?? 'migration-apply-report.json';
      writeApplyReportJson(outPath, report);
      const human = formatApplyReport(report);
      return {
        exitCode: report.ok ? 0 : 1,
        stdout: `${human}\nreport: ${outPath}\n`,
        stderr: report.ok ? '' : `${report.errors.join('\n')}\n`,
      };
    }
    if (command === 'verify') {
      if (env.MIGRATION_ENV === 'PRODUCTION' && !deps?.prisma && !PRODUCTION_APPLY_EXECUTION_ENABLED) {
        throw new ApplyGateError(
          'Production migrate:verify does not open DATABASE_URL in this phase. Prepared only; no production connection.',
        );
      }
      const config = configFromArgs(args, env);
      const clients = readClients(env, deps);
      const persistStatus = env.MIGRATION_ENV !== 'PRODUCTION';
      const result = await runMigrationVerify({
        prisma: clients.prisma,
        storage: clients.storage,
        config,
        persistStatus,
      });
      return {
        exitCode: result.verification.ok ? 0 : 1,
        stdout: `verify ok=${result.verification.ok} status=${result.status}\n`,
        stderr: result.verification.ok ? '' : `${result.verification.errors.join('\n')}\n`,
      };
    }
    if (command === 'production-preflight') {
      const config = configFromArgs(args, env);
      const backupEvidencePath =
        opt(args, '--backup-evidence') ?? env.MIGRATION_BACKUP_EVIDENCE;
      if (!backupEvidencePath) {
        throw new ApplyGateError('production-preflight requires --backup-evidence.');
      }
      const report = await runProductionPreflight(config, {
        prisma: deps?.prisma,
        env,
        backupEvidencePath,
      });
      const outPath = config.reportPath ?? 'migration-production-report.json';
      writeProductionReportJson(outPath, report);
      return {
        exitCode: report.ok ? 0 : 1,
        stdout: `Production preflight ok=${report.ok}\nreport: ${outPath}\nexecutionEnabled=${PRODUCTION_APPLY_EXECUTION_ENABLED}\n`,
        stderr: '',
      };
    }
    if (command === 'pilot-readiness') {
      const backupEvidencePath =
        opt(args, '--backup-evidence') ?? env.PILOT_BACKUP_EVIDENCE ?? env.MIGRATION_BACKUP_EVIDENCE;
      const report = await runPilotReadiness({
        env,
        prisma: deps?.prisma,
        backupEvidencePath,
        cli: {
          sourceJsonPath: opt(args, '--source'),
          sourceMediaRoot: opt(args, '--media'),
          targetOrganizationId: opt(args, '--organization-id'),
        },
      });
      const outPath = opt(args, '--out') ?? 'pilot-readiness-report.json';
      writeProductionReportJson(outPath, report);
      const human = formatPilotReadiness(report);
      return {
        exitCode: report.verdict === 'READY_FOR_PILOT_APPLY' ? 0 : 1,
        stdout: `${human}\nreport: ${outPath}\nproductionApply=DISABLED\n`,
        stderr: report.verdict === 'READY_FOR_PILOT_APPLY' ? '' : `${report.blockers.map((b) => b.message).join('\n')}\n`,
      };
    }
    if (command !== 'dry-run' && command !== 'validate' && command !== 'plan') {
      return {
        exitCode: 1,
        stdout: '',
        stderr:
          'Usage: migrate:dry-run | migrate:validate | migrate:plan | migrate:apply | migrate:rollback | migrate:verify | migrate:production-preflight | migrate:pilot-readiness\nStaging APPLY: MIGRATION_ENV=STAGING. Production APPLY execution is disabled. Pilot readiness is read-only.\n',
      };
    }
    const config = configFromArgs(args, env);
    const result = runDryRun(config);
    const human = formatHumanReport(result.report);
    if (command === 'plan') {
      const plan = [
        'Migration plan (no writes)',
        `order: ${MIGRATION_PLAN_ORDER.join(' → ')}`,
        `mappings: ${JSON.stringify(result.report.mappings)}`,
        human,
      ].join('\n');
      return { exitCode: result.report.ok ? 0 : 1, stdout: `${plan}\n`, stderr: '' };
    }
    if (config.reportPath) {
      writeReportJson(config.reportPath, result.report);
    }
    return { exitCode: result.report.ok ? 0 : 1, stdout: `${human}\n`, stderr: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 1, stdout: '', stderr: `${message}\n` };
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && thisFile === process.argv[1]) {
  const { exitCode, stdout, stderr } = await runMigrationCli(process.argv.slice(2));
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(exitCode);
}
