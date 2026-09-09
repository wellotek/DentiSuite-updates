import { ApplyGateError } from './apply-gate.js';
import { isLiveAppDataStorePath } from './source-paths.js';

export type PilotIdentity = {
  sourceJsonPath: string;
  sourceMediaRoot: string;
  targetOrganizationId: string;
  liveAppDataRefused: boolean;
};

export type PilotIdentityInput = {
  sourceJsonPath?: string;
  sourceMediaRoot?: string;
  targetOrganizationId?: string;
};

/**
 * Pilot cabinet must be operator-supplied. Never inferred from AppData,
 * never taken from source JSON, never defaulted to another organization.
 */
export function parsePilotIdentity(env: NodeJS.ProcessEnv, cli: PilotIdentityInput = {}): PilotIdentity {
  const sourceJsonPath = env.PILOT_SOURCE_JSON;
  const sourceMediaRoot = env.PILOT_MEDIA_ROOT;
  const targetOrganizationId = env.PILOT_TARGET_ORGANIZATION_ID;
  if (!sourceJsonPath || !sourceMediaRoot || !targetOrganizationId) {
    throw new ApplyGateError(
      'Pilot identity requires PILOT_SOURCE_JSON, PILOT_MEDIA_ROOT, and PILOT_TARGET_ORGANIZATION_ID.',
    );
  }
  if (cli.sourceJsonPath && cli.sourceJsonPath !== sourceJsonPath) {
    throw new ApplyGateError('--source must match PILOT_SOURCE_JSON.');
  }
  if (cli.sourceMediaRoot && cli.sourceMediaRoot !== sourceMediaRoot) {
    throw new ApplyGateError('--media must match PILOT_MEDIA_ROOT.');
  }
  if (cli.targetOrganizationId && cli.targetOrganizationId !== targetOrganizationId) {
    throw new ApplyGateError('--organization-id must match PILOT_TARGET_ORGANIZATION_ID.');
  }
  return {
    sourceJsonPath,
    sourceMediaRoot,
    targetOrganizationId,
    liveAppDataRefused: isLiveAppDataStorePath(sourceJsonPath),
  };
}
