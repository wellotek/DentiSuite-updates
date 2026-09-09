/**
 * Explicit operator confirmation for the five open product decisions.
 * Current approved values are the only ones accepted. Missing or different
 * values do not silently fall back to defaults.
 */
export const REQUIRED_PILOT_POLICY_VALUES = {
  walkInInvoice: 'SKIP',
  walkInPrescription: 'SKIP',
  emptyPhone: 'ERROR',
  settings: 'DEFERRED',
  actCatalog: 'DEFERRED',
} as const;

export type PilotPolicyId =
  | 'walk-in-invoice'
  | 'walk-in-prescription'
  | 'empty-phone'
  | 'settings'
  | 'act-catalog';

export type PilotPolicyDecision = {
  id: PilotPolicyId;
  title: string;
  envName: string;
  requiredValue: string;
  suppliedValue: string | undefined;
  confirmed: boolean;
  policy: string;
  decision: string;
  impact: string;
};

const SPECS: Array<{
  id: PilotPolicyId;
  title: string;
  envName: string;
  requiredValue: string;
  policy: string;
  impact: string;
}> = [
  {
    id: 'walk-in-invoice',
    title: 'Walk-in invoice policy',
    envName: 'PILOT_POLICY_WALK_IN_INVOICE',
    requiredValue: REQUIRED_PILOT_POLICY_VALUES.walkInInvoice,
    policy: 'SKIP — Cloud Invoice requires patientId; walk-ins are not migrated',
    impact: 'Patientless invoices are classified and omitted from Cloud. No Invoice row is created.',
  },
  {
    id: 'walk-in-prescription',
    title: 'Walk-in prescription policy',
    envName: 'PILOT_POLICY_WALK_IN_PRESCRIPTION',
    requiredValue: REQUIRED_PILOT_POLICY_VALUES.walkInPrescription,
    policy: 'SKIP — Cloud Prescription requires patientId; walk-ins are not migrated',
    impact: 'Patientless prescriptions are classified and omitted from Cloud. No Prescription row is created.',
  },
  {
    id: 'empty-phone',
    title: 'Empty phone policy',
    envName: 'PILOT_POLICY_EMPTY_PHONE',
    requiredValue: REQUIRED_PILOT_POLICY_VALUES.emptyPhone,
    policy: 'ERROR in strict mode — never invent a phone number; source is not modified',
    impact: 'Patients with empty phone are blocking errors. They are not migrated and no placeholder phone is written.',
  },
  {
    id: 'settings',
    title: 'ClinicSettings migration',
    envName: 'PILOT_POLICY_SETTINGS',
    requiredValue: REQUIRED_PILOT_POLICY_VALUES.settings,
    policy: 'DEFERRED — no Cloud Settings model. Optional settings.name → Organization.name only if --copy-organization-name (default off)',
    impact: 'Local clinic settings stay on the JSON copy. Cloud Organization is not overwritten by default.',
  },
  {
    id: 'act-catalog',
    title: 'ActCatalog migration',
    envName: 'PILOT_POLICY_ACT_CATALOG',
    requiredValue: REQUIRED_PILOT_POLICY_VALUES.actCatalog,
    policy: 'DEFERRED — catalog rows are not imported. Treatment.act / code / actId stay opaque',
    impact: 'No ActCatalog table is created. Treatments keep act, code, and actId as stored on the source row.',
  },
];

export type PilotPolicyResult = {
  ok: boolean;
  decisions: PilotPolicyDecision[];
};

export function parsePilotPolicies(env: NodeJS.ProcessEnv): PilotPolicyResult {
  const decisions = SPECS.map((spec) => {
    const suppliedValue = env[spec.envName];
    const confirmed = suppliedValue === spec.requiredValue;
    let decision: string;
    if (suppliedValue === undefined || suppliedValue === '') {
      decision = 'MISSING — not confirmed (defaults are not accepted)';
    } else if (!confirmed) {
      decision = `REJECTED — supplied ${suppliedValue}; only ${spec.requiredValue} is approved`;
    } else {
      decision = `CONFIRMED ${spec.requiredValue}`;
    }
    return {
      id: spec.id,
      title: spec.title,
      envName: spec.envName,
      requiredValue: spec.requiredValue,
      suppliedValue,
      confirmed,
      policy: spec.policy,
      decision,
      impact: spec.impact,
    };
  });
  return { ok: decisions.every((d) => d.confirmed), decisions };
}
