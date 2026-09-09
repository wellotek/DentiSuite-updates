export type IssueSeverity = 'ERROR' | 'WARNING' | 'SKIPPED' | 'INFO';

export type Issue = {
  severity: IssueSeverity;
  code: string;
  entity: string;
  localId?: string;
  message: string;
  details?: Record<string, unknown>;
};

export function issue(
  severity: IssueSeverity,
  code: string,
  entity: string,
  message: string,
  extra?: { localId?: string; details?: Record<string, unknown> },
): Issue {
  return {
    severity,
    code,
    entity,
    message,
    localId: extra?.localId,
    details: extra?.details,
  };
}
