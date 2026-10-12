import api from '@/lib/api';
import { apiClient } from '@/api/client';
import type { CoachRoleSummaryDto } from '@/api/generated';

interface AddRoleResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  addedRole: string;
}

/** POST /users/me/roles — also restores a removed role; returns a fresh token pair either way. */
export async function addRole(role: string): Promise<AddRoleResponse> {
  const { data } = await api.post<AddRoleResponse>('/users/me/roles', { role });
  return data;
}

/** Client counts for one active coach role, with the optional fields resolved. */
export interface CoachRoleSummary {
  role: string;
  clientCount: number;
  sharedWithOtherRoleCount: number;
}

function toSummary(dto: CoachRoleSummaryDto): CoachRoleSummary | null {
  if (!dto.role) return null;
  return {
    role: dto.role,
    clientCount: dto.clientCount ?? 0,
    sharedWithOtherRoleCount: dto.sharedWithOtherRoleCount ?? 0,
  };
}

function toSummaries(dtos: CoachRoleSummaryDto[] | undefined): CoachRoleSummary[] {
  return (dtos ?? []).flatMap((dto) => toSummary(dto) ?? []);
}

/** The caller's active coach roles plus the coach-account disable dates. */
export interface MyCoachRoles {
  roles: CoachRoleSummary[];
  /** Stored end date while a disable is pending; null otherwise. */
  coachAccountActiveUntil: string | null;
  /** Date the account would stop being active if disabled now; at or before now means at once. */
  activeUntilIfDisabled: string | null;
}

/** GET /users/me/roles — the caller's ACTIVE coach roles with client counts and disable dates. */
export async function getMyCoachRoles(): Promise<MyCoachRoles> {
  const result = await apiClient.getMyCoachRolesEndpoint();
  return {
    roles: toSummaries(result.roles),
    coachAccountActiveUntil: result.coachAccountActiveUntil ?? null,
    activeUntilIfDisabled: result.activeUntilIfDisabled ?? null,
  };
}

/** Outcome of POST /users/me/coach-account/disable. */
export interface DisableCoachAccountResult {
  activeUntil: string | null;
  /** Roles removed by this call; empty while the disable is only pending. */
  rolesRemoved: string[];
}

/**
 * POST /users/me/coach-account/disable — 400 NO_ACTIVE_COACH_ROLE.
 * The Identity roles stay in the JWT, so no token change follows.
 */
export async function disableCoachAccount(): Promise<DisableCoachAccountResult> {
  const result = await apiClient.disableCoachAccountEndpoint();
  return { activeUntil: result.activeUntil ?? null, rolesRemoved: result.rolesRemoved ?? [] };
}

/** POST /users/me/coach-account/keep — 400 COACH_ACCOUNT_NOT_DISABLING / COACH_ACCOUNT_DISABLE_ENDED. */
export async function keepCoachAccount(): Promise<void> {
  await apiClient.keepCoachAccountEndpoint();
}


/**
 * DELETE /users/me/roles/{role} — 400 ROLE_NOT_ASSIGNED / ONLY_COACH_ROLE.
 * The JWT keeps the Identity role, so no token change follows.
 */
export async function removeCoachRole(role: string): Promise<{ removedRole: string }> {
  const result = await apiClient.removeCoachRoleEndpoint(role);
  return { removedRole: result.removedRole ?? role };
}

export const rolesKeys = {
  mine: ['roles', 'me'] as const,
};

/** True when the date is still ahead; at or before now there is no paid period left. */
export function isInFuture(iso: string | null, now = Date.now()): boolean {
  return iso !== null && new Date(iso).getTime() > now;
}

/** Long date in the UI locale, e.g. "31 October 2026". */
export function formatLongDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}
