import type { Logger } from '../lib/logger.js';

export type OrgEvent =
  | { type: 'organization_created'; organizationId: string; userId: string; membershipId: string }
  | { type: 'organization_updated'; organizationId: string; userId: string }
  | { type: 'membership_created'; membershipId: string; userId: string; organizationId: string; role: string }
  | { type: 'membership_disabled'; membershipId: string; userId: string; organizationId: string }
  | { type: 'license_binding_created'; organizationId: string; licenseBindingId: string };

export function logOrgEvent(logger: Logger, event: OrgEvent): void {
  logger.info({ orgEvent: event.type, ...event }, 'org_event');
}
