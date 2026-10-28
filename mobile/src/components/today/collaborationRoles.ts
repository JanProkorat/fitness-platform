import { LinkCapabilityScope } from '@/api/generated';
import type { ClientInvite } from '@/api/invites';
import type { Collaboration } from '@/api/collaborations';
import type { PlanKind } from '@/api/plans';

export type CoachRole = 'Trainer' | 'Nutritionist';

export const COACH_ROLES: readonly CoachRole[] = ['Trainer', 'Nutritionist'];

/** The roles a collaboration type covers; null, undefined or an unknown value covers none. */
export function rolesForScope(scope: LinkCapabilityScope | string | null | undefined): CoachRole[] {
  switch (scope) {
    case LinkCapabilityScope.Both:
      return ['Trainer', 'Nutritionist'];
    case LinkCapabilityScope.TrainingOnly:
      return ['Trainer'];
    case LinkCapabilityScope.NutritionOnly:
      return ['Nutritionist'];
    default:
      return [];
  }
}

export const roleForPlanKind = (kind: PlanKind): CoachRole =>
  kind === 'nutrition' ? 'Nutritionist' : 'Trainer';

export type CoveredCollaboration = {
  collaboration: Collaboration;
  roles: CoachRole[];
};

/** Collaborations that cover at least one role, with those roles. */
export function coveredCollaborations(collaborations: readonly Collaboration[]): CoveredCollaboration[] {
  return collaborations
    .map((collaboration) => ({ collaboration, roles: rolesForScope(collaboration.coveredType) }))
    .filter((entry) => entry.roles.length > 0);
}

export type OfferedInvite = {
  invite: ClientInvite;
  /** The roles this invite would fill that no coach covers yet. */
  roles: CoachRole[];
};

/** Invites that would fill at least one still-open role; the rest stay off Today. */
export function offeredInvites(
  invites: readonly ClientInvite[],
  missing: readonly CoachRole[],
): OfferedInvite[] {
  return invites
    .map((invite) => ({
      invite,
      roles: rolesForScope(invite.offeredType).filter((role) => missing.includes(role)),
    }))
    .filter((entry) => entry.roles.length > 0);
}
